import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Avisos() {
  const [avisos, setAvisos] = useState([])
  const [allAvisos, setAllAvisos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [periodo, setPeriodo] = useState({ inicio: '', fim: '' })
  const [search, setSearch] = useState('')
  const [filterInicio, setFilterInicio] = useState('')
  const [filterFim, setFilterFim] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [page, setPage] = useState(1)
  const [pageSize] = useState(10)
  const [hasMore, setHasMore] = useState(false)

  function formatBR(dateStr) {
    if (!dateStr) return ''
    try {
      const [y, m, d] = dateStr.slice(0, 10).split('-')
      if (y && m && d) return `${d}/${m}/${y}`
      const dt = new Date(dateStr)
      const dd = String(dt.getDate()).padStart(2, '0')
      const mm = String(dt.getMonth() + 1).padStart(2, '0')
      const yy = String(dt.getFullYear())
      return `${dd}/${mm}/${yy}`
    } catch {
      return dateStr
    }
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        if (supabase.from) {
          const { data, error } = await supabase
            .from('avisos')
            .select('*')
            .order('id', { ascending: false })
            .range(0, pageSize - 1)
          if (error) throw error
          const list = data || []
          setAvisos(list)
          setHasMore(list.length === pageSize)
          // Migração automática: inserir itens de localStorage que não existem ainda
          try {
            const rawLocal = localStorage.getItem('avisos-list')
            const localList = rawLocal ? JSON.parse(rawLocal) : []
            const keyOf = (a) => `${String(a.titulo||'').trim()}|${(Array.isArray(a.periodos)&&a.periodos[0]?.inicio)||String((Array.isArray(a.datas)&&a.datas[0])||'').slice(0,10)}`
            const keysRemote = new Set(list.map(keyOf))
            const toInsert = (Array.isArray(localList)?localList:[]).filter(a => !keysRemote.has(keyOf(a)))
            if (toInsert.length) {
              const normalized = toInsert.map(a => {
                const periods = Array.isArray(a.periodos) && a.periodos.length ? a.periodos : (Array.isArray(a.datas)? a.datas.map(d => ({inicio: d, fim: d})) : [])
                return { titulo: String(a.titulo||'').trim(), periodos: periods }
              })
              const { data: insertedRows, error: insertErr } = await supabase
                .from('avisos')
                .insert(normalized)
                .select('*')
              if (!insertErr && Array.isArray(insertedRows)) {
                const merged = [...insertedRows, ...list]
                setAvisos(merged.slice(0, pageSize))
                setHasMore(merged.length >= pageSize)
              }
            }
          } catch (migErr) {
            console.warn('Migração automática de avisos para Supabase falhou:', migErr)
          }
        } else {
          const seed = [
            { id: 1, titulo: 'Jejum congregacional na sexta', criadoEm: '2025-10-07' },
            { id: 2, titulo: 'Mutirão de limpeza sábado 9h', criadoEm: '2025-10-10' },
          ]
          setAllAvisos(seed)
          setAvisos(seed.slice(0, pageSize))
          setHasMore(seed.length > pageSize)
        }
      } catch (e) {
        console.error(e)
        const seed = [
          { id: 1, titulo: 'Jejum congregacional na sexta', criadoEm: '2025-10-07' },
          { id: 2, titulo: 'Mutirão de limpeza sábado 9h', criadoEm: '2025-10-10' },
        ]
        setAllAvisos(seed)
        setAvisos(seed.slice(0, pageSize))
        setHasMore(seed.length > pageSize)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  async function handleCreate(e) {
    e.preventDefault()
    if (!titulo.trim()) {
      alert('Informe o título do aviso.')
      return
    }
    if (!periodo.inicio || !periodo.fim) {
      alert('Informe o período: data de início e data de fim.')
      return
    }
    try {
      const criadoEm = new Date().toISOString().slice(0, 10)
      const selectedPeriods = [{ inicio: periodo.inicio, fim: periodo.fim }]
      if (supabase.from) {
        // Tenta inserir com coluna JSON 'datas' (requer coluna existente no banco)
        let inserted
        try {
          // Preferir coluna 'periodos' como JSON [{inicio, fim}]
          const { data, error } = await supabase
            .from('avisos')
            .insert([{ titulo, periodos: selectedPeriods }])
            .select('*')
          if (error) throw error
          inserted = Array.isArray(data) ? data[0] : data
          if (inserted && !inserted.criadoEm) inserted.criadoEm = criadoEm
        } catch (err) {
          console.warn('Falha ao inserir com coluna periodos; tentando alternativa:', err?.message)
          // Tenta usar coluna antiga 'datas' como array simples (de/até o mesmo dia)
          try {
            const { data, error } = await supabase
              .from('avisos')
              .insert([{ titulo, datas: selectedPeriods.map(p => p.inicio) }])
              .select('*')
            if (error) throw error
            inserted = Array.isArray(data) ? data[0] : data
            if (inserted) inserted.periodos = selectedPeriods
            if (inserted && !inserted.criadoEm) inserted.criadoEm = criadoEm
          } catch (err2) {
            const { data, error } = await supabase
              .from('avisos')
              .insert([{ titulo }])
              .select('*')
            if (error) throw error
            inserted = Array.isArray(data) ? data[0] : data
            if (inserted) inserted.periodos = selectedPeriods
            if (inserted && !inserted.criadoEm) inserted.criadoEm = criadoEm
          }
        }
        setAvisos(prev => inserted ? [inserted, ...prev] : prev)
      } else {
        const novo = { id: Date.now(), titulo, criadoEm, periodos: selectedPeriods }
        setAvisos(prev => [novo, ...prev])
        setAllAvisos(prev => [novo, ...prev])
      }
      setTitulo('')
      setPeriodo({ inicio: '', fim: '' })
      setShowForm(false)
    } catch (e) {
      console.error(e)
      alert('Erro ao criar aviso: ' + (e?.message || 'tente novamente'))
    }
  }

  async function handleSearch(e) {
    e?.preventDefault?.()
    const q = search.trim()
    const inicio = filterInicio
    const fim = filterFim
    setLoading(true)
    setPage(1)
    try {
      if (supabase.from) {
        const from = 0
        const to = pageSize - 1
        let query = supabase
          .from('avisos')
          .select('*')
          .order('id', { ascending: false })
          .range(from, to)
        if (q) {
          try {
            query = query.or(`titulo.ilike.%${q}%,conteudo.ilike.%${q}%,descricao.ilike.%${q}%`)
          } catch {
            query = query.ilike('titulo', `%${q}%`)
          }
        }
        const { data, error } = await query
        if (error) throw error
        const list = filterLocal(data || [], q, inicio, fim)
        setAvisos(list)
        setHasMore((data || []).length === pageSize)
      } else {
        const filtered = filterLocal(allAvisos, q, inicio, fim)
        setAvisos(filtered.slice(0, pageSize))
        setHasMore(filtered.length > pageSize)
      }
    } catch (err) {
      alert('Erro na busca: ' + (err?.message || 'tente novamente'))
    } finally {
      setLoading(false)
    }
  }

  function filterLocal(list, q, inicio, fim) {
    const qq = (q || '').toLowerCase()
    return (list || []).filter(a => {
      const textMatch = !qq || [a.titulo, a.conteudo, a.descricao]
        .filter(Boolean)
        .some(v => (v || '').toLowerCase().includes(qq))
      const periodMatch = matchesPeriod(a, inicio, fim)
      return textMatch && periodMatch
    })
  }

  async function handleClear() {
    setSearch('')
    setFilterInicio('')
    setFilterFim('')
    setSelectedIds([])
    setLoading(true)
    setPage(1)
    try {
      if (supabase.from) {
        const from = 0
        const to = pageSize - 1
        const { data, error } = await supabase
          .from('avisos')
          .select('*')
          .order('id', { ascending: false })
          .range(from, to)
        if (error) throw error
        const list = data || []
        setAvisos(list)
        setHasMore(list.length === pageSize)
      } else {
        const filtered = allAvisos
        setAvisos(filtered.slice(0, pageSize))
        setHasMore(filtered.length > pageSize)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleLoadMore() {
    if (loading || !hasMore) return
    const q = search.trim()
    const inicio = filterInicio
    const fim = filterFim
    setLoading(true)
    try {
      if (supabase.from) {
        const nextPage = page + 1
        const from = (nextPage - 1) * pageSize
        const to = nextPage * pageSize - 1
        let query = supabase
          .from('avisos')
          .select('*')
          .order('id', { ascending: false })
          .range(from, to)
        if (q) {
          try {
            query = query.or(`titulo.ilike.%${q}%,conteudo.ilike.%${q}%,descricao.ilike.%${q}%`)
          } catch {
            query = query.ilike('titulo', `%${q}%`)
          }
        }
        const { data, error } = await query
        if (error) throw error
        const fetched = filterLocal(data || [], q, inicio, fim)
        setAvisos(prev => [...prev, ...fetched])
        setHasMore((data || []).length === pageSize)
        setPage(nextPage)
      } else {
        const base = filterLocal(allAvisos, q, inicio, fim)
        const nextPage = page + 1
        const slice = base.slice(page * pageSize, nextPage * pageSize)
        setAvisos(prev => [...prev, ...slice])
        setHasMore(base.length > nextPage * pageSize)
        setPage(nextPage)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id) {
    if (!id) return
    try {
      if (supabase.from) {
        const { error } = await supabase
          .from('avisos')
          .delete()
          .eq('id', id)
        if (error) throw error
      }
      setAvisos(prev => prev.filter(a => a.id !== id))
      setAllAvisos(prev => prev.filter(a => a.id !== id))
    } catch (err) {
      alert('Erro ao excluir: ' + (err?.message || 'tente novamente'))
    }
  }

  function resolveCreatedDate(a) {
    return a?.criadoEm || a?.created_at || a?.createdAt || a?.created || a?.inserted_at || ''
  }

  function matchesPeriod(a, inicio, fim) {
    if (!inicio || !fim) return true
    const start = new Date(inicio)
    const end = new Date(fim)
    if (Array.isArray(a.periodos) && a.periodos.length) {
      for (const p of a.periodos) {
        const ps = new Date(p.inicio)
        const pe = new Date(p.fim)
        if (ps <= end && pe >= start) return true
      }
      return false
    }
    if (Array.isArray(a.datas) && a.datas.length) {
      for (const d of a.datas) {
        const dd = new Date(d)
        if (dd >= start && dd <= end) return true
      }
      return false
    }
    return false
  }

  // Debounce da busca ao digitar e ajustar filtros de período
  useEffect(() => {
    const t = setTimeout(() => {
      const hasText = !!search.trim()
      const hasPeriod = !!(filterInicio && filterFim)
      if (hasText || hasPeriod) {
        handleSearch()
      }
    }, 350)
    return () => clearTimeout(t)
  }, [search, filterInicio, filterFim])

  // Removido: sincronização com localStorage para evitar divergências entre navegadores

  function handlePrint() {
    try {
      const base = Array.isArray(avisos) ? avisos : []
      const items = selectedIds.length ? base.filter(a => selectedIds.includes(a.id)) : base
      const generatedAt = new Date()
      const genDate = `${String(generatedAt.getDate()).padStart(2,'0')}/${String(generatedAt.getMonth()+1).padStart(2,'0')}/${generatedAt.getFullYear()}`
      const genTime = `${String(generatedAt.getHours()).padStart(2,'0')}:${String(generatedAt.getMinutes()).padStart(2,'0')}`
      const rows = items.map((a) => {
        const criado = formatBR(resolveCreatedDate(a))
        const periodos = Array.isArray(a.periodos) && a.periodos.length > 0
          ? a.periodos.map(p => `De ${formatBR(p.inicio)} até ${formatBR(p.fim)}`).join(', ')
          : Array.isArray(a.datas) && a.datas.length > 0
            ? a.datas.map(d => `De ${formatBR(d)} até ${formatBR(d)}`).join(', ')
            : ''
        return `
          <div class="item">
            <div class="header">
              <span class="titulo">${(a.titulo || '').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>
              <span class="criado">Criado em: ${criado || '-'}</span>
            </div>
            ${periodos ? `<div class="periodos">${periodos}</div>` : ''}
          </div>
        `
      }).join('\n')

      const html = `<!doctype html>
        <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Avisos - Impressão</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
          <style>
            * { box-sizing: border-box; }
            body { font-family: Roboto, Arial, sans-serif; color: #111827; margin: 24px; }
            .print-header { display:flex; align-items:center; justify-content:space-between; margin-bottom: 16px; }
            .print-title { font-family: Montserrat, Roboto, Arial, sans-serif; font-size: 20px; font-weight:700; color: #071722; }
            .print-meta { text-align:right; font-size:12px; color: #6b7280; }
            .logo { height: 40px; }
            .item { border: 1px solid #e5e7eb; padding: 12px; margin-bottom: 10px; border-radius: 6px; }
            .header { display: flex; justify-content: space-between; align-items: baseline; }
            .titulo { font-weight: 600; }
            .criado { font-size: 12px; color: #6b7280; }
            .periodos { margin-top: 6px; font-size: 13px; color: #071722; }
            @media print {
              body { margin: 8mm; }
              .item { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="print-header">
            <div style="display:flex; align-items:center; gap:12px;">
              <img src="/smhb-logo.png" alt="SMHB" class="logo" onerror="this.style.display='none'" />
              <div class="print-title">Avisos</div>
            </div>
            <div class="print-meta">
              <div>Gerado em: ${genDate} ${genTime}</div>
              ${filterInicio && filterFim ? `<div>Filtro período: ${formatBR(filterInicio)} - ${formatBR(filterFim)}</div>` : ''}
              ${search?.trim() ? `<div>Busca: ${(search || '').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>` : ''}
            </div>
          </div>
          ${items.length === 0 ? '<p>Nenhum aviso.</p>' : rows}
          <script>
            window.onload = function(){
              setTimeout(function(){ window.print(); }, 200);
            };
          </script>
        </body>
        </html>`

      const printWindow = window.open('', '_blank', 'width=800,height=900')
      if (!printWindow) {
        alert('Pop-up bloqueado. Permita pop-ups para imprimir.')
        return
      }
      printWindow.document.open()
      printWindow.document.write(html)
      printWindow.document.close()
    } catch (err) {
      alert('Erro ao preparar impressão: ' + (err?.message || 'tente novamente'))
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-montserrat text-2xl font-bold text-primary dark:text-light">Avisos</h1>
      {/* Barra de busca */}
      <form onSubmit={handleSearch} className="card">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por título"
            className="flex-1"
          />
          <input
            type="date"
            value={filterInicio}
            onChange={e => setFilterInicio(e.target.value)}
          />
          <input
            type="date"
            value={filterFim}
            onChange={e => setFilterFim(e.target.value)}
          />
          <button type="submit" className="btn-neon">Buscar</button>
          <button type="button" className="btn-neon" onClick={handleClear}>Limpar</button>
          <button type="button" className="btn-neon" onClick={handlePrint}>Imprimir PDF</button>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button type="button" className="btn-neon text-xs px-2 py-1" onClick={() => setSelectedIds(avisos.map(a => a.id))}>Selecionar todos</button>
          <button type="button" className="btn-neon text-xs px-2 py-1" onClick={() => setSelectedIds([])}>Limpar seleção</button>
          <button type="button" className="btn-neon text-xs px-2 py-1" onClick={handlePrint}>Imprimir selecionados</button>
        </div>
      </form>
      <div className="card p-0">
        {loading ? (
          <div className="p-4">Carregando...</div>
        ) : avisos.length === 0 ? (
          <div className="p-4">Nenhum aviso cadastrado.</div>
        ) : (
          <ul className="divide-y">
            {avisos.map((a) => (
              <li key={a.id} className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium dark:text-gray-100">{a.titulo}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">Criado em: {formatBR(resolveCreatedDate(a))}</span>
                </div>
                <div className="mt-2">
                  <label className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input type="checkbox" checked={selectedIds.includes(a.id)} onChange={(e) => {
                      setSelectedIds(prev => e.target.checked ? [...prev, a.id] : prev.filter(id => id !== a.id))
                    }} />
                    Selecionar para impressão
                  </label>
                </div>
                {/* Exibição de períodos (inicio/fim). Fallback: 'datas' como dias únicos */}
                {Array.isArray(a.periodos) && a.periodos.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.periodos.slice(0,3).map((p, idx) => (
                      <span key={idx} className="badge badge-dates">De {formatBR(p.inicio)} até {formatBR(p.fim)}</span>
                    ))}
                  </div>
                ) : Array.isArray(a.datas) && a.datas.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {a.datas.slice(0,3).map((d, idx) => (
                      <span key={idx} className="badge badge-dates">De {formatBR(d)} até {formatBR(d)}</span>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3">
                  <button className="btn-neon text-xs px-2 py-1" onClick={() => handleDelete(a.id)}>Excluir</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-center">
        {hasMore ? (
          <button className="btn-neon" onClick={handleLoadMore} disabled={loading}>
            {loading ? 'Carregando...' : 'Carregar mais'}
          </button>
        ) : (
          !loading && <span className="text-sm text-gray-500">Fim da lista</span>
        )}
      </div>
      {showForm ? (
        <form onSubmit={handleCreate} className="card space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Título do aviso</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className="w-full" placeholder="Digite o título" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Período</label>
            <div className="grid md:grid-cols-2 gap-2">
              <input type="date" value={periodo.inicio} onChange={e => setPeriodo(p => ({ ...p, inicio: e.target.value }))} />
              <input type="date" value={periodo.fim} onChange={e => setPeriodo(p => ({ ...p, fim: e.target.value }))} />
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">Informe data de início e data de fim.</p>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-neon">Salvar</button>
            <button type="button" className="btn-neon" onClick={() => { setShowForm(false); setTitulo(''); setPeriodo({inicio:'', fim:''}) }}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button className="btn-neon" onClick={() => setShowForm(true)}>Novo Aviso</button>
      )}
    </div>
  )
}