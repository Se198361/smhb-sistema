import { useEffect, useState } from 'react'

export default function Membros() {
  const [query, setQuery] = useState('')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [nome, setNome] = useState('')
  const [endereco, setEndereco] = useState('')
  const [telefone, setTelefone] = useState('')
  const [aniversario, setAniversario] = useState('')
  const [foto, setFoto] = useState('')
  const [editingId, setEditingId] = useState(null)

  function handleFotoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result || '')
      setFoto(url)
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem('membros-list')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setMembers(parsed)
        else setMembers([])
      } else {
        setMembers([
          { id: 1, nome: 'João Silva', endereco: 'Rua das Flores, 123', telefone: '(11) 99999-0000' },
          { id: 2, nome: 'Maria Souza', endereco: 'Av. Central, 456', telefone: '(11) 98888-1111' },
        ])
      }
    } catch {
      setMembers([])
    }
    setLoading(false)
  }, [])

  function handleAdd(e) {
    e.preventDefault()
    if (!nome.trim() || !endereco.trim() || !telefone.trim()) {
      alert('Informe nome, endereço e telefone do membro.')
      return
    }
    // Se estiver editando, atualiza membro existente
    if (editingId !== null) {
      const next = members.map(m => m.id === editingId ? { ...m, nome, endereco, telefone, aniversario, foto } : m)
      setMembers(next)
      try { localStorage.setItem('membros-list', JSON.stringify(next)) } catch {}
      try { window.dispatchEvent(new CustomEvent('membros:updated')) } catch {}
      setEditingId(null)
      setNome('')
      setEndereco('')
      setTelefone('')
      setAniversario('')
      setFoto('')
      setShowForm(false)
      return
    }
    // Caso contrário, adiciona novo membro
    const novo = { id: Date.now(), nome, endereco, telefone, aniversario, foto }
    const next = [novo, ...members]
    setMembers(next)
    try { localStorage.setItem('membros-list', JSON.stringify(next)) } catch {}
    try { window.dispatchEvent(new CustomEvent('membros:updated')) } catch {}
    setNome('')
    setEndereco('')
    setTelefone('')
    setAniversario('')
    setFoto('')
    setShowForm(false)
  }

  const filtered = members.filter(m => m.nome.toLowerCase().includes(query.toLowerCase()))

  function startEdit(m) {
    setEditingId(m.id ?? null)
    setNome(m.nome ?? '')
    setEndereco(m.endereco ?? m.grupo ?? '')
    setTelefone(m.telefone ?? '')
    setAniversario(m.aniversario ?? '')
    setFoto(m.foto ?? '')
    setShowForm(true)
  }

  function formatBR(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) {
      const [y, m, day] = String(iso).split('-')
      return `${day?.padStart(2, '0')}/${m?.padStart(2, '0')}/${y}`
    }
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

  function handlePrint() {
    if (!members || members.length === 0) {
      alert('Não há membros para imprimir.')
      return
    }
    const genAt = new Date().toLocaleString('pt-BR')
    const html = `<!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Membros</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
        h1 { margin: 0 0 8px 0; font-size: 20px; }
        .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
        th { background: #f7f7f7; text-align: left; }
        img { height: 32px; width: 32px; object-fit: cover; border-radius: 4px; }
      </style>
    </head>
    <body>
      <h1>Lista de Membros</h1>
      <div class="meta">Gerado em: ${genAt}</div>
      <table>
        <thead>
          <tr>
            <th>Foto</th>
            <th>Nome</th>
            <th>Endereço</th>
            <th>Telefone</th>
            <th>Aniversário</th>
          </tr>
        </thead>
        <tbody>
          ${members.map(m => `
            <tr>
              <td>${m.foto ? `<img src="${m.foto}" />` : ''}</td>
              <td>${m.nome}</td>
              <td>${m.endereco ?? m.grupo ?? ''}</td>
              <td>${m.telefone}</td>
              <td>${m.aniversario ? formatBR(m.aniversario) : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <script>
        window.onload = () => window.print();
      </script>
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
      setTimeout(() => {
        URL.revokeObjectURL(url)
        document.body.removeChild(iframe)
      }, 4000)
    } catch {}
  }
  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar por nome" className="w-full" />
        <button className="btn-neon" onClick={() => { setEditingId(null); setNome(''); setEndereco(''); setTelefone(''); setAniversario(''); setFoto(''); setShowForm(true) }}>Adicionar Membro</button>
      </div>
      {showForm && (
        <form onSubmit={handleAdd} className="card space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Nome</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} className="w-full" placeholder="Nome completo" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Endereço</label>
            <input type="text" value={endereco} onChange={e => setEndereco(e.target.value)} className="w-full" placeholder="Ex.: Rua Exemplo, 123" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Telefone</label>
            <input type="text" value={telefone} onChange={e => setTelefone(e.target.value)} className="w-full" placeholder="(11) 99999-0000" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Data de aniversário</label>
            <input type="date" value={aniversario} onChange={e => setAniversario(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Foto do membro</label>
            <input type="file" accept="image/*" onChange={handleFotoChange} />
            {foto && (
              <div className="mt-2">
                <img src={foto} alt="Preview" className="max-h-24 rounded" />
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-neon">{editingId !== null ? 'Salvar alterações' : 'Salvar'}</button>
            <button type="button" className="btn-neon" onClick={() => { setShowForm(false); setEditingId(null); setNome(''); setEndereco(''); setTelefone(''); setAniversario(''); setFoto('') }}>Cancelar</button>
          </div>
        </form>
      )}
      <div className="card p-0">
        {loading ? (
          <div className="p-3">Carregando...</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left">
                <th className="p-3">Nome</th>
                <th className="p-3">Endereço</th>
                <th className="p-3">Telefone</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="border-t">
                  <td className="p-3 dark:text-gray-100">
                    <div className="flex items-center gap-2">
                      {m.foto && <img src={m.foto} alt="Foto" className="h-8 w-8 rounded object-cover" />}
                      <span>{m.nome}</span>
                    </div>
                  </td>
                  <td className="p-3 dark:text-gray-100">{m.endereco ?? m.grupo}</td>
                  <td className="p-3 dark:text-gray-100">{m.telefone}</td>
                  <td className="p-3">
                    <button className="btn-neon text-sm px-3 py-1" onClick={() => startEdit(m)}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" className="btn-neon" onClick={handlePrint}>Imprimir PDF</button>
      </div>
    </div>
  )
}