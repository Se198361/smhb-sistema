import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Celulas() {
  const [items, setItems] = useState([])
  const [nome, setNome] = useState('')
  const [cargo, setCargo] = useState('')
  const [foto, setFoto] = useState('')

  useEffect(() => {
    async function load() {
      try {
        if (supabase.from) {
          const { data, error } = await supabase
            .from('diretoria')
            .select('id,nome,cargo,foto')
            .order('id', { ascending: true })
          if (error) throw error
          const list = Array.isArray(data) ? data : []
          setItems(list)
          try { localStorage.setItem('diretoria-list', JSON.stringify(list)) } catch {}
          // Migração automática: inserir no Supabase itens existentes no localStorage que não estejam na tabela
          try {
            const rawLocal = localStorage.getItem('diretoria-list')
            const localList = rawLocal ? JSON.parse(rawLocal) : []
            const keyOf = (p) => `${String(p.nome||'').trim()}|${String(p.cargo||'').trim()}`
            const keysRemote = new Set(list.map(keyOf))
            const toInsert = (Array.isArray(localList) ? localList : []).filter(p => !keysRemote.has(keyOf(p)))
            if (toInsert.length) {
              const normalized = toInsert.map(p => ({
                nome: String(p.nome||'').trim(),
                cargo: String(p.cargo||'').trim(),
                foto: p.foto || ''
              }))
              const { data: insertedRows, error: insertErr } = await supabase
                .from('diretoria')
                .insert(normalized)
                .select('id,nome,cargo,foto')
              if (!insertErr && Array.isArray(insertedRows)) {
                const merged = [...list, ...insertedRows]
                setItems(merged)
                try { localStorage.setItem('diretoria-list', JSON.stringify(merged)) } catch {}
              }
            }
          } catch (migErr) {
            console.warn('Migração automática de diretoria falhou ou não necessária:', migErr)
          }
        } else {
          const raw = localStorage.getItem('diretoria-list')
          const list = raw ? JSON.parse(raw) : []
          setItems(Array.isArray(list) ? list : [])
        }
      } catch (e) {
        console.warn('Falha ao carregar diretoria do Supabase, usando localStorage.', e)
        try {
          const raw = localStorage.getItem('diretoria-list')
          const list = raw ? JSON.parse(raw) : []
          setItems(Array.isArray(list) ? list : [])
        } catch {}
      }
    }
    load()
  }, [])

  function handleFotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setFoto(String(reader.result || ''))
    reader.readAsDataURL(file)
  }

  async function handleAdd(e) {
    e?.preventDefault?.()
    const nomeTrim = nome.trim()
    const cargoTrim = cargo.trim()
    if (!nomeTrim || !cargoTrim) {
      alert('Preencha nome e cargo.')
      return
    }
    const newItem = { id: Date.now(), nome: nomeTrim, cargo: cargoTrim, foto }
    try {
      if (supabase.from) {
        const { error } = await supabase
          .from('diretoria')
          .insert([newItem])
        if (error) throw error
      }
      const next = [...items, newItem]
      setItems(next)
      try { localStorage.setItem('diretoria-list', JSON.stringify(next)) } catch {}
      setNome('')
      setCargo('')
      setFoto('')
    } catch (err) {
      console.error('Erro ao salvar no Supabase, mantendo localStorage:', err)
      const next = [...items, newItem]
      setItems(next)
      try { localStorage.setItem('diretoria-list', JSON.stringify(next)) } catch {}
      setNome('')
      setCargo('')
      setFoto('')
    }
  }

  async function handleDelete(id) {
    try {
      if (supabase.from) {
        const { error } = await supabase
          .from('diretoria')
          .delete()
          .eq('id', id)
        if (error) throw error
      }
      const next = items.filter(i => i.id !== id)
      setItems(next)
      try { localStorage.setItem('diretoria-list', JSON.stringify(next)) } catch {}
    } catch (err) {
      console.error('Erro ao excluir no Supabase, atualizando localStorage mesmo assim:', err)
      const next = items.filter(i => i.id !== id)
      setItems(next)
      try { localStorage.setItem('diretoria-list', JSON.stringify(next)) } catch {}
    }
  }

  function handleClear() {
    if (!items.length) return
    const ok = confirm('Deseja limpar toda a diretoria? Essa ação não pode ser desfeita.')
    if (!ok) return
    setItems([])
    try { localStorage.setItem('diretoria-list', JSON.stringify([])) } catch {}
  }

  function handlePrint() {
    if (!items || items.length === 0) {
      alert('Não há membros da diretoria para imprimir.')
      return
    }
    const genAt = new Date().toLocaleString('pt-BR')
    const rows = items.map(m => `
      <tr>
        <td>${m.foto ? `<img src="${m.foto}" style="height:32px;width:32px;object-fit:cover;border-radius:4px;" />` : ''}</td>
        <td>${m.nome || ''}</td>
        <td>${m.cargo || ''}</td>
      </tr>
    `).join('')
    const html = `<!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Diretoria Atual</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
        h1 { margin: 0 0 8px 0; font-size: 20px; }
        .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
        th { background: #f7f7f7; text-align: left; }
      </style>
    </head>
    <body>
      <h1>Diretoria Atual</h1>
      <div class="meta">Gerado em: ${genAt}</div>
      <table>
        <thead>
          <tr>
            <th>Foto</th>
            <th>Nome</th>
            <th>Cargo</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
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
      <h1 className="font-montserrat text-2xl font-bold text-primary dark:text-light">Diretoria Atual</h1>

      <div className="card">
        <div className="flex justify-between items-center">
          <h2 className="font-montserrat font-semibold text-primary dark:text-light">Diretoria Atual</h2>
          <div className="flex gap-2">
            <button className="btn-neon" onClick={handlePrint}>Imprimir Diretoria</button>
            <button className="btn-neon" onClick={handleClear}>Limpar Diretoria</button>
          </div>
        </div>
        
        <form className="space-y-3" onSubmit={handleAdd}>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Nome</label>
              <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full" placeholder="Ex.: João Silva" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Cargo</label>
              <input type="text" value={cargo} onChange={e => setCargo(e.target.value)} className="w-full" placeholder="Ex.: Presidente, Vice, Secretário" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Foto</label>
              <input type="file" accept="image/*" onChange={handleFotoChange} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-neon">Adicionar à Diretoria</button>
          </div>
        </form>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {items.map((m) => (
          <div key={m.id} className="card">
            <div className="flex items-center gap-3">
              {m.foto && (<img src={m.foto} alt="Foto" className="h-12 w-12 rounded object-cover" />)}
              <div>
                <h3 className="font-montserrat font-semibold text-primary dark:text-light">{m.nome}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300">{m.cargo}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button className="btn-neon" onClick={() => handleDelete(m.id)}>Excluir</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}