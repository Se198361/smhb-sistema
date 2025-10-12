import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Crachas() {
  const [nome, setNome] = useState('')
  const [ts, setTs] = useState('')
  const [idNumero, setIdNumero] = useState('')
  const [batismo, setBatismo] = useState('')
  const [igreja, setIgreja] = useState('')
  const [foto, setFoto] = useState('')
  const [cargo, setCargo] = useState('MEMBRO')
  const [templateImg, setTemplateImg] = useState('')
  const [templateName, setTemplateName] = useState('')
  const [backImg, setBackImg] = useState('')
  const [backName, setBackName] = useState('')
  const [loadingPdf, setLoadingPdf] = useState(false)
  const badgeRef = useRef(null)
  const backRef = useRef(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('badge-template')
      if (raw) {
        const { img, name } = JSON.parse(raw)
        if (img) setTemplateImg(img)
        if (name) setTemplateName(name)
      }
      const backRaw = localStorage.getItem('badge-back')
      if (backRaw) {
        const { img: bimg, name: bname } = JSON.parse(backRaw)
        if (bimg) setBackImg(bimg)
        if (bname) setBackName(bname)
      }
    } catch {}
    // Carregar defaults do Storage se existir e não houver localStorage
    (async () => {
      try {
        if (supabase.storage) {
          const bucket = supabase.storage.from('crachas')
          if (!templateImg) {
            const pub = bucket.getPublicUrl('templates/template.png')
            const url = pub?.data?.publicUrl
            if (url) setTemplateImg(url)
          }
          if (!backImg) {
            const pub = bucket.getPublicUrl('templates/back.png')
            const url = pub?.data?.publicUrl
            if (url) setBackImg(url)
          }
        }
      } catch {}
    })()
  }, [])

  // Migração automática: se o template/costa estiverem como dataURL, envia para Supabase Storage e passa a usar URL pública
  useEffect(() => {
    (async () => {
      try {
        if (!supabase.storage) return
        // Template
        if (templateImg && String(templateImg).startsWith('data:')) {
          const publicUrl = await uploadImageToStorage(String(templateImg), 'templates/template.png')
          if (publicUrl) {
            setTemplateImg(publicUrl)
            try { localStorage.setItem('badge-template', JSON.stringify({ img: publicUrl, name: templateName || 'template.png' })) } catch {}
          }
        }
        // Costa
        if (backImg && String(backImg).startsWith('data:')) {
          const publicUrl = await uploadImageToStorage(String(backImg), 'templates/back.png')
          if (publicUrl) {
            setBackImg(publicUrl)
            try { localStorage.setItem('badge-back', JSON.stringify({ img: publicUrl, name: backName || 'back.png' })) } catch {}
          }
        }
      } catch (e) {
        console.warn('Migração automática de imagens de crachás para Storage falhou:', e)
      }
    })()
  }, [templateImg, backImg, templateName, backName])

  // Sincroniza localStorage quando estiver usando URLs públicas (não dataURL)
  useEffect(() => {
    try {
      if (templateImg && !String(templateImg).startsWith('data:')) {
        localStorage.setItem('badge-template', JSON.stringify({ img: templateImg, name: templateName || 'template.png' }))
      }
      if (backImg && !String(backImg).startsWith('data:')) {
        localStorage.setItem('badge-back', JSON.stringify({ img: backImg, name: backName || 'back.png' }))
      }
    } catch {}
  }, [templateImg, backImg, templateName, backName])

  function handleFotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setFoto(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  async function ensurePdfJs() {
    // Carrega pdf.js via CDN somente quando necessário
    if (window.pdfjsLib) return window.pdfjsLib
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js'
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
    // worker
    const w = document.createElement('script')
    w.src = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'
    document.head.appendChild(w)
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = w.src
    return window.pdfjsLib
  }

  async function ensureHtml2Canvas() {
    if (window.html2canvas) return window.html2canvas
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
    return window.html2canvas
  }

  async function ensureJsPDF() {
    if (window.jspdf) return window.jspdf
    await new Promise((resolve, reject) => {
      const s = document.createElement('script')
      s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'
      s.onload = resolve
      s.onerror = reject
      document.head.appendChild(s)
    })
    return window.jspdf
  }

  async function handleExportPdf() {
    try {
      const html2canvas = await ensureHtml2Canvas()
      const jspdf = await ensureJsPDF()
      const nodeFront = badgeRef.current
      const nodeBack = backRef.current
      if (!nodeFront) {
        alert('Preview não encontrado.')
        return
      }
      const canvasFront = await html2canvas(nodeFront, { scale: 2, useCORS: true, backgroundColor: null })
      const imgFront = canvasFront.toDataURL('image/png')
      let imgBack = ''
      if (nodeBack) {
        const canvasBack = await html2canvas(nodeBack, { scale: 2, useCORS: true, backgroundColor: null })
        imgBack = canvasBack.toDataURL('image/png')
      }
      const { jsPDF } = jspdf
      // Documento em milímetros para CR-80 86x54mm (modo paisagem ou retrato). Usaremos retrato 54x86.
      const pdf = new jsPDF({ unit: 'mm', format: [54, 86], orientation: 'portrait' })
      // O preview é 320x480px; mapeamos para 54x86mm preenchendo completamente mantendo proporção
      pdf.addImage(imgFront, 'PNG', 0, 0, 54, 86)
      // Costa
      pdf.addPage()
      if (imgBack) {
        pdf.addImage(imgBack, 'PNG', 0, 0, 54, 86)
      } else {
        // Se não houver costa, preencher com um fundo padrão
        // Criamos uma página em branco com o mesmo gradiente padrão
        // jsPDF não desenha gradiente nativamente, mas poderíamos inserir um retângulo colorido.
        // Para simplicidade, repetimos a frente sem conteúdo capturando o fundo do preview.
        pdf.addImage(imgFront, 'PNG', 0, 0, 54, 86)
      }
      pdf.save(`cracha_${(nome || 'membro').replace(/\s+/g,'_')}.pdf`)
    } catch (e) {
      alert('Falha ao exportar PDF: ' + (e?.message || 'tente novamente'))
    }
  }

  async function renderPdfToImage(file) {
    setLoadingPdf(true)
    try {
      const pdfjsLib = await ensurePdfJs()
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const page = await pdf.getPage(1)
      const viewport = page.getViewport({ scale: 2 })
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      canvas.width = viewport.width
      canvas.height = viewport.height
      await page.render({ canvasContext: ctx, viewport }).promise
      const dataUrl = canvas.toDataURL('image/png')
      return dataUrl
    } catch (e) {
      alert('Falha ao processar PDF do modelo. Envie uma imagem (PNG/JPG) como alternativa.')
      return ''
    } finally {
      setLoadingPdf(false)
    }
  }

  async function handleTemplateChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const name = file.name
    setTemplateName(name)
    if (file.type === 'application/pdf') {
      const img = await renderPdfToImage(file)
      if (img) {
        setTemplateImg(img)
        try { localStorage.setItem('badge-template', JSON.stringify({ img, name })) } catch {}
      }
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || '')
      setTemplateImg(url)
      try { localStorage.setItem('badge-template', JSON.stringify({ img: url, name })) } catch {}
      // Upload para Storage e usar URL pública para compartilhar entre navegadores
      (async () => {
        const publicUrl = await uploadImageToStorage(url, 'templates/template.png')
        if (publicUrl) {
          setTemplateImg(publicUrl)
          try { localStorage.setItem('badge-template', JSON.stringify({ img: publicUrl, name })) } catch {}
        }
      })()
    }
    reader.readAsDataURL(file)
  }

  async function handleBackChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const name = file.name
    setBackName(name)
    if (file.type === 'application/pdf') {
      const img = await renderPdfToImage(file)
      if (img) {
        setBackImg(img)
        try { localStorage.setItem('badge-back', JSON.stringify({ img, name })) } catch {}
      }
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || '')
      setBackImg(url)
      try { localStorage.setItem('badge-back', JSON.stringify({ img: url, name })) } catch {}
      (async () => {
        const publicUrl = await uploadImageToStorage(url, 'templates/back.png')
        if (publicUrl) {
          setBackImg(publicUrl)
          try { localStorage.setItem('badge-back', JSON.stringify({ img: publicUrl, name })) } catch {}
        }
      })()
    }
    reader.readAsDataURL(file)
  }

  // Opcional: upload das imagens para Supabase Storage para persistência entre dispositivos
  async function uploadImageToStorage(dataUrl, path) {
    try {
      if (!supabase.storage) return null
      const bucket = supabase.storage.from('crachas')
      // Converter dataURL para Blob
      const res = await fetch(dataUrl)
      const blob = await res.blob()
      const { data, error } = await bucket.upload(path, blob, { upsert: true, contentType: blob.type || 'image/png' })
      if (error) throw error
      const publicUrl = bucket.getPublicUrl(path)?.data?.publicUrl
      return publicUrl || null
    } catch (e) {
      console.warn('Falha ao enviar imagem para Storage:', e)
      return null
    }
  }

  function formatBR(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) {
      const [y, m, dd] = String(iso).split('-')
      return `${dd?.padStart(2, '0')}/${m?.padStart(2, '0')}/${y}`
    }
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

  function handlePrint() {
    const genAt = new Date().toLocaleString('pt-BR')
    // Conversão aproximada: Preview 320x480px -> CR-80 86x54mm (orientação retrato)
    // Usaremos layout em mm com proporção semelhante: largura 54mm, altura 86mm
    const html = `<!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Cracha</title>
      <style>
        * { box-sizing: border-box; }
        @page { size: 54mm 86mm; margin: 0; }
        html, body { height: 100%; }
        body { margin: 0; padding: 0; background: #fff; }
        .print-root { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        .badge { position: relative; width: 54mm; height: 86mm; overflow: hidden; border-radius: 2mm; }
        .bg { position: absolute; inset: 0; background: ${templateImg ? `url('${templateImg}') center/cover no-repeat` : 'linear-gradient(180deg,#11558a 0%,#0a3560 100%)'}; }
        .content { position: absolute; inset: 0; padding: 4mm 4mm; display: flex; flex-direction: column; align-items: center; color: #fff; font-family: Montserrat, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .brand { text-align:center; margin-top: 2mm; padding: 1mm 2mm; border-radius: 2mm; display: inline-block; }
        .brand .title { font-size: 6mm; margin: 0; letter-spacing: 0.3mm; color: #001f4d; font-weight: 800; }
        .brand .sub { font-size: 3mm; margin: 0; color: #001f4d; font-weight: 700; }
        .photo-wrap { margin-top: 4mm; height: 20mm; width: 20mm; border-radius: 50%; overflow: hidden; border: 1mm solid rgba(255,255,255,0.6); box-shadow: 0 0 0 0.5mm rgba(255,255,255,0.25); }
        .photo-wrap img { height: 100%; width: 100%; object-fit: cover; }
        .name { margin-top: 4mm; font-size: 6mm; font-weight: 800; text-align: center; }
        .role { font-size: 3.2mm; opacity: 0.9; }
        .grid { margin-top: 3mm; width: 100%; font-size: 3mm; }
        .row { display: grid; grid-template-columns: auto 1fr; gap: 2mm; padding: 1mm 0; border-top: 0.3mm solid rgba(255,255,255,0.2); }
        .row:first-child { border-top: none; }
        .label { opacity: 0.9; }
        .value { font-weight: 600; white-space: normal; word-break: break-word; overflow: visible; text-overflow: clip; }
        @media print {
          .badge { box-shadow: none; }
        }
      </style>
    </head>
    <body>
      <div class="print-root">
        <div class="badge">
          <div class="bg"></div>
          <div class="content">
            <div class="brand">
              <div class="title">SMHB</div>
              <div class="sub">REMIDOS DO SENHOR</div>
            </div>
            <div class="photo-wrap">${foto ? `<img src="${foto}" />` : ''}</div>
            <div class="name">${nome || 'NOME DO MEMBRO'}</div>
            <div class="role">${cargo || 'MEMBRO'}</div>
            <div class="grid">
              <div class="row"><div class="label">ID</div><div class="value">${idNumero || ''}</div></div>
              <div class="row"><div class="label">T.S</div><div class="value">${ts || ''}</div></div>
              <div class="row"><div class="label">BATISMO</div><div class="value">${formatBR(batismo) || ''}</div></div>
              <div class="row"><div class="label">IGREJA</div><div class="value">${igreja || ''}</div></div>
            </div>
          </div>
        </div>
      </div>
      <script>window.onload = () => window.print();</script>
    </body>
    </html>`
    try {
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      iframe.src = url
      document.body.appendChild(iframe)
      setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(iframe) }, 5000)
    } catch {}
  }

  return (
    <div className="space-y-6">
      <h1 className="font-montserrat text-2xl font-bold text-primary dark:text-light">Crachás</h1>
      <div className="card">
        <div className="grid md:grid-cols-2 gap-6">
          <form className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Nome</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full" placeholder="Ex.: DAVID ANDREWS" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">ID</label>
                <input type="text" value={idNumero} onChange={e => setIdNumero(e.target.value)} className="w-full" placeholder="Ex.: 123 000 000 000" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">T.S</label>
                <input type="text" value={ts} onChange={e => setTs(e.target.value)} className="w-full" placeholder="Ex.: AB" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">Batismo</label>
                <input type="date" value={batismo} onChange={e => setBatismo(e.target.value)} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 dark:text-gray-200">Igreja</label>
                <input type="text" value={igreja} onChange={e => setIgreja(e.target.value)} className="w-full" placeholder="Ex.: IGREJA BATISTA DO NOBRE" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Cargo</label>
              <input type="text" value={cargo} onChange={e => setCargo(e.target.value)} className="w-full" placeholder="Ex.: MEMBRO, DIÁCONO, LÍDER" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Foto do membro</label>
              <input type="file" accept="image/*" onChange={handleFotoChange} />
              {foto && (<div className="mt-2"><img src={foto} alt="Foto" className="h-24 w-24 object-cover rounded" /></div>)}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Modelo do crachá (PDF/Imagem)</label>
              <input type="file" accept="application/pdf,image/*" onChange={handleTemplateChange} />
              {loadingPdf && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Processando PDF...</p>}
              {templateImg && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Modelo carregado: {templateName || 'imagem'}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Costa do crachá (PDF/Imagem)</label>
              <input type="file" accept="application/pdf,image/*" onChange={handleBackChange} />
              {loadingPdf && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Processando PDF...</p>}
              {backImg && <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">Costa carregada: {backName || 'imagem'}</p>}
            </div>
            <div className="flex gap-2 mt-2">
              <button type="button" className="btn-neon" onClick={handlePrint}>Imprimir Crachá</button>
              <button type="button" className="btn-neon" onClick={handleExportPdf}>Exportar PDF</button>
            </div>
          </form>
          <div>
            <div ref={badgeRef} className="relative overflow-hidden rounded-lg border border-primary/40 shadow-md" style={{ width: 320, height: 480 }}>
              {/* Background template */}
              <div style={{ position: 'absolute', inset: 0, background: templateImg ? `url(${templateImg}) center/cover no-repeat` : 'linear-gradient(180deg,#11558a 0%,#0a3560 100%)' }} />
              {/* Overlay content */}
              <div className="absolute inset-0 px-4 py-3 flex flex-col items-center text-white">
                <div className="mt-2 text-center inline-block rounded px-2 py-1">
                  <div className="text-lg font-extrabold tracking-wider text-[#001f4d]">SMHB</div>
                  <div className="text-xs font-bold text-[#001f4d]">REMIDOS DO SENHOR</div>
                </div>
                <div className="mt-4 h-32 w-32 rounded-full overflow-hidden ring-4 ring-white/60 shadow">
                  {foto && <img src={foto} alt="Foto" className="h-full w-full object-cover" />}
                </div>
                <div className="mt-4 text-xl font-extrabold text-center">{nome || 'NOME DO MEMBRO'}</div>
                <div className="text-sm opacity-90">{cargo || 'MEMBRO'}</div>
                <div className="mt-3 w-full text-xs">
                  <div className="grid grid-cols-[auto_1fr] gap-2 py-1 border-t border-white/20">
                    <div className="opacity-90">ID</div>
                    <div className="font-semibold">{idNumero}</div>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-2 py-1 border-t border-white/20">
                    <div className="opacity-90">T.S</div>
                    <div className="font-semibold">{ts}</div>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-2 py-1 border-t border-white/20">
                    <div className="opacity-90">BATISMO</div>
                    <div className="font-semibold">{formatBR(batismo)}</div>
                  </div>
                  <div className="grid grid-cols-[auto_1fr] gap-2 py-1 border-t border-white/20">
                    <div className="opacity-90">IGREJA</div>
                    <div className="font-semibold whitespace-normal break-words">{igreja}</div>
                  </div>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-300 mt-2">Preview aproximado do crachá. O PDF final usa dimensões reais.</p>
            <div ref={backRef} className="relative overflow-hidden rounded-lg border border-primary/40 shadow-md mt-4" style={{ width: 320, height: 480 }}>
              {/* Background back side */}
              <div style={{ position: 'absolute', inset: 0, background: backImg ? `url(${backImg}) center/cover no-repeat` : 'linear-gradient(180deg,#11558a 0%,#0a3560 100%)' }} />
            </div>
            <p className="text-xs text-gray-300 mt-2">Preview da costa (verso) do crachá.</p>
          </div>
        </div>
      </div>
    </div>
  )
}