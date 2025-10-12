import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Financas() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [tipo, setTipo] = useState('')
  const [valor, setValor] = useState('')
  const [data, setData] = useState('')
  const [pagante, setPagante] = useState('')
  const [uso, setUso] = useState('')
  const [deleteTipo, setDeleteTipo] = useState('')

  function formatBR(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) {
      // Fallback para strings já em YYYY-MM-DD
      const [y, m, day] = String(iso).split('-')
      return `${day?.padStart(2, '0')}/${m?.padStart(2, '0')}/${y}`
    }
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

  function labelTipo(t) {
    const map = {
      acao_social: 'Ação Social',
      oferta: 'Oferta',
      oferta_mensal: 'Oferta mensal',
      despesa: 'Despesa',
      // suporte a dados antigos
      dizimo: 'Dízimo',
    }
    return map[String(t)] ?? String(t).replace('_', ' ')
  }

  useEffect(() => {
    async function load() {
      try {
        const fallbackLocal = () => {
          const raw = localStorage.getItem('financas-list')
          const list = raw ? JSON.parse(raw) : []
          list.sort((a, b) => String(b.data).localeCompare(String(a.data)))
          setItems(list)
        }
        if (supabase.from) {
          try {
            const { data, error } = await supabase
              .from('financas')
              .select('*')
              .order('data', { ascending: false })
            if (error) throw error
            if (Array.isArray(data)) {
              setItems(data)
              // Migração automática: inserir no Supabase itens existentes no localStorage que não estejam na tabela
              try {
                const rawLocal = localStorage.getItem('financas-list')
                const localList = rawLocal ? JSON.parse(rawLocal) : []
                const keyOf = (i) => `${String(i.tipo)}|${String(i.valor)}|${String(i.data).slice(0,10)}|${String(i.pagante||'')}`
                const keysRemote = new Set(data.map(keyOf))
                const toInsert = (Array.isArray(localList) ? localList : []).filter(i => !keysRemote.has(keyOf(i)))
                if (toInsert.length) {
                  const normalized = toInsert.map(i => ({
                    tipo: i.tipo,
                    valor: Number(i.valor||0),
                    data: String(i.data).slice(0,10),
                    pagante: String(i.pagante||'').trim(),
                    uso: String(i.tipo) === 'despesa' ? String(i.uso||'').trim() : ''
                  }))
                  const { data: insertedRows, error: insertErr } = await supabase
                    .from('financas')
                    .insert(normalized)
                    .select('*')
                  if (!insertErr && Array.isArray(insertedRows)) {
                    const merged = [...insertedRows, ...data].sort((a, b) => String(b.data).localeCompare(String(a.data)))
                    setItems(merged)
                    try { localStorage.setItem('financas-list', JSON.stringify(merged)) } catch {}
                    try { window.dispatchEvent(new CustomEvent('financas:updated')) } catch {}
                  }
                }
              } catch (migErr) {
                console.warn('Migração automática de finanças falhou ou não necessária:', migErr)
              }
            } else {
              fallbackLocal()
            }
          } catch (err) {
            console.warn('Supabase indisponível, usando localStorage:', err)
            fallbackLocal()
          }
        } else {
          fallbackLocal()
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totalReceitas = useMemo(() => items.filter(i => i.tipo !== 'despesa').reduce((acc, i) => acc + Number(i.valor || 0), 0), [items])
  const totalDespesas = useMemo(() => items.filter(i => i.tipo === 'despesa').reduce((acc, i) => acc + Number(i.valor || 0), 0), [items])
  const saldo = useMemo(() => totalReceitas - totalDespesas, [totalReceitas, totalDespesas])

  async function handleSave() {
    const vStr = String(valor).trim().replace(/\s+/g, '')
    const vNum = Number(vStr.replace(/\./g, '').replace(',', '.'))
    if (!tipo || !data || !valor || Number.isNaN(vNum) || vNum <= 0 || !pagante || (tipo === 'despesa' && !uso)) {
      alert('Preencha Tipo, Valor (> 0), Data, Pagante e (se Despesa) Uso.')
      return
    }

    try {
      if (supabase.from) {
        const { data: inserted, error } = await supabase
          .from('financas')
          .insert([{ tipo, valor: vNum, data, pagante, uso: tipo === 'despesa' ? uso : '' }])
          .select()
        if (error) {
          console.error(error)
          // Fallback local se inserir falhar por schema diferente
          const novoLocal = { id: Date.now(), tipo, valor: vNum, data, pagante, uso: tipo === 'despesa' ? uso : '' }
          const nextLocal = [novoLocal, ...items].sort((a, b) => String(b.data).localeCompare(String(a.data)))
          setItems(nextLocal)
          localStorage.setItem('financas-list', JSON.stringify(nextLocal))
        } else {
          const novo = Array.isArray(inserted) ? inserted[0] : inserted
          setItems(prev => [novo, ...prev].sort((a, b) => String(b.data).localeCompare(String(a.data))))
        }
      } else {
        const novo = { id: Date.now(), tipo, valor: vNum, data, pagante, uso: tipo === 'despesa' ? uso : '' }
        const next = [novo, ...items].sort((a, b) => String(b.data).localeCompare(String(a.data)))
        setItems(next)
        localStorage.setItem('financas-list', JSON.stringify(next))
      }
      // Notificar Dashboard para atualizar imediatamente
      try { window.dispatchEvent(new CustomEvent('financas:updated')) } catch {}
      // limpar e fechar
      setTipo('')
      setValor('')
      setData('')
      setPagante('')
      setUso('')
      setShowForm(false)
    } catch (e) {
      console.error(e)
      alert('Falha ao salvar lançamento.')
    }
  }

  function handleExport() {
    if (!items || items.length === 0) {
      alert('Não há lançamentos para exportar.')
      return
    }
    const header = ['Tipo', 'Valor', 'Data']
    const rows = items.map(i => [
      labelTipo(i.tipo),
      Number(i.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      formatBR(i.data)
    ])
    const csv = [header, ...rows].map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'financas.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Agrupar por mês (YYYY-MM)
  const groupsByMonth = useMemo(() => {
    const map = new Map()
    for (const i of items) {
      const key = String(i.data).slice(0, 7) // YYYY-MM
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(i)
    }
    // ordenar meses desc e itens por data desc
    const entries = Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
    return entries.map(([key, arr]) => ({
      key,
      label: (() => {
        const [y, m] = key.split('-')
        const dt = new Date(Number(y), Number(m) - 1, 1)
        return dt.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
      })(),
      items: arr.sort((a, b) => String(b.data).localeCompare(String(a.data)))
    }))
  }, [items])

  const tiposDisponiveis = useMemo(() => {
    const set = new Set(items.map(i => String(i.tipo)))
    return Array.from(set).sort()
  }, [items])

  function handlePrintPDF() {
    if (!items || items.length === 0) {
      alert('Não há lançamentos para imprimir.')
      return
    }
    const receitasStr = Number(totalReceitas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const despesasStr = Number(totalDespesas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const saldoStr = Number(saldo).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const saldoColor = saldo >= 0 ? '#137a2b' : '#b91c1c'
    const genAt = new Date().toLocaleString('pt-BR')
    const html = `<!doctype html>
    <html lang="pt-BR">
    <head>
      <meta charset="utf-8" />
      <title>Finanças - Lançamentos Mensais</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 24px; color: #111; }
        h1 { margin: 0 0 8px 0; font-size: 20px; }
        .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
        .summary { border: 1px solid #ddd; padding: 10px; margin: 10px 0 18px 0; font-size: 13px; }
        .summary-row { display: flex; gap: 24px; }
        .summary-row div { margin: 2px 0; }
        .balance { font-weight: 700; }
        .month { margin-top: 18px; font-size: 16px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin-top: 8px; }
        th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
        th { background: #f7f7f7; text-align: left; }
      </style>
    </head>
    <body>
      <h1>Finanças - Lançamentos Mensais</h1>
      <div class="meta">Gerado em: ${genAt}</div>
      <div class="summary">
        <div class="summary-row">
          <div><strong>Receitas:</strong> R$ ${receitasStr}</div>
          <div><strong>Despesas:</strong> R$ ${despesasStr}</div>
        </div>
        <div class="balance" style="color: ${saldoColor}"><strong>Saldo total em caixa:</strong> R$ ${saldoStr}</div>
      </div>
      ${groupsByMonth.map(g => `
        <div class="month">${g.label}</div>
        <table>
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Valor</th>
              <th>Data</th>
              <th>Pagante</th>
              <th>Uso da despesa</th>
            </tr>
          </thead>
          <tbody>
            ${g.items.map(i => `
              <tr>
                <td>${labelTipo(i.tipo)}</td>
                <td>R$ ${Number(i.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>${formatBR(i.data)}</td>
                <td>${i.pagante ? escapeHtml(i.pagante) : ''}</td>
                <td>${i.tipo === 'despesa' ? (i.uso ? escapeHtml(i.uso) : '') : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `).join('')}
      <script>
        window.onload = () => window.print();
      </script>
    </body>
    </html>`
    const w = window.open('', '_blank')
    if (w && w.document) {
      w.document.open()
      w.document.write(html)
      w.document.close()
    } else {
      // Fallback: usar iframe escondido no mesmo documento
      const iframe = document.createElement('iframe')
      iframe.style.position = 'fixed'
      iframe.style.right = '0'
      iframe.style.bottom = '0'
      iframe.style.width = '0'
      iframe.style.height = '0'
      iframe.style.border = '0'
      document.body.appendChild(iframe)
      const doc = iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(html)
        doc.close()
        setTimeout(() => {
          try { iframe.contentWindow?.print() } catch {}
          setTimeout(() => { document.body.removeChild(iframe) }, 2000)
        }, 200)
      }
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  async function handleDelete(item) {
    const ok = window.confirm('Excluir este lançamento?')
    if (!ok) return
    try {
      // Excluir no Supabase quando disponível para refletir em todos os usuários/navegadores
      if (supabase.from) {
        if (item?.id != null) {
          const { error } = await supabase.from('financas').delete().eq('id', item.id)
          if (error) throw error
        } else {
          // Melhor esforço: excluir por composição dos campos quando não há id
          try {
            const { error } = await supabase
              .from('financas')
              .delete()
              .eq('tipo', String(item.tipo))
              .eq('valor', Number(item.valor || 0))
              .eq('data', String(item.data).slice(0, 10))
              .eq('pagante', String(item.pagante || '').trim())
              .eq('uso', String(item.tipo) === 'despesa' ? String(item.uso || '').trim() : '')
            if (error) console.warn('Falha ao excluir remoto por composição:', error)
          } catch (e) {
            console.warn('Exclusão remota por composição não realizada:', e)
          }
        }
      }
      // Atualizar lista local e localStorage
      const next = items.filter((i) => {
        if (item?.id != null) return i.id !== item.id
        const sameBase =
          String(i.tipo) === String(item.tipo) &&
          Number(i.valor || 0) === Number(item.valor || 0) &&
          String(i.data).slice(0, 10) === String(item.data).slice(0, 10) &&
          String(i.pagante || '').trim() === String(item.pagante || '').trim()
        const sameUso = String(item.tipo) === 'despesa' ? (String(i.uso || '').trim() === String(item.uso || '').trim()) : true
        const isSame = sameBase && sameUso
        return !isSame
      }).sort((a, b) => String(b.data).localeCompare(String(a.data)))
      setItems(next)
      try { localStorage.setItem('financas-list', JSON.stringify(next)) } catch {}
      try { window.dispatchEvent(new CustomEvent('financas:updated')) } catch {}
    } catch (e) {
      console.error(e)
      alert('Falha ao excluir lançamento.')
    }
  }

  async function handleDeleteByTipo() {
    if (!deleteTipo) return
    const label = labelTipo(deleteTipo)
    const ok = window.confirm(`Excluir TODOS os lançamentos do tipo "${label}"?`)
    if (!ok) return
    try {
      if (supabase.from) {
        try {
          const { error } = await supabase.from('financas').delete().eq('tipo', deleteTipo)
          if (error) throw error
        } catch (e) {
          console.warn('Falha ao excluir no Supabase por tipo:', e)
        }
      }
      const next = items.filter(i => String(i.tipo) !== String(deleteTipo))
      setItems(next)
      try { localStorage.setItem('financas-list', JSON.stringify(next)) } catch {}
      try { window.dispatchEvent(new CustomEvent('financas:updated')) } catch {}
      setDeleteTipo('')
    } catch (e) {
      console.error(e)
      alert('Falha ao excluir por tipo.')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-montserrat text-2xl font-bold text-primary dark:text-light">Finanças</h1>
      <div className="card">
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Receitas</p>
            <p className="text-lg font-semibold text-green-700 dark:text-green-400">R$ {totalReceitas.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Despesas</p>
            <p className="text-lg font-semibold text-red-700 dark:text-red-400">R$ {totalDespesas.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Saldo</p>
            <p className={`text-lg font-semibold ${saldo >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>R$ {saldo.toFixed(2)}</p>
          </div>
        </div>
        {showForm && (
          <div className="mt-6 grid md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tipo</label>
              <select value={tipo} onChange={e => setTipo(e.target.value)} className="input w-full">
                <option value="">Selecione</option>
                <option value="acao_social">Ação Social</option>
                <option value="oferta">Oferta</option>
                <option value="oferta_mensal">Oferta mensal</option>
                <option value="despesa">Despesa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Valor</label>
              <input type="number" step="0.01" value={valor} onChange={e => setValor(e.target.value)} className="input w-full text-black" placeholder="0,00" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className="input w-full" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Pagante</label>
              <input type="text" value={pagante} onChange={e => setPagante(e.target.value)} className="input w-full" placeholder="Nome de quem pagou" />
            </div>
            {tipo === 'despesa' && (
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Uso da despesa</label>
                <input type="text" value={uso} onChange={e => setUso(e.target.value)} className="input w-full" placeholder="Para que foi usada a despesa" />
              </div>
            )}
            <div className="flex items-end gap-2 md:col-span-2">
              <button onClick={handleSave} className="btn-neon">Salvar</button>
              <button onClick={() => { setShowForm(false); setTipo(''); setValor(''); setData(''); setPagante(''); setUso('') }} className="btn-neon">Cancelar</button>
            </div>
          </div>
        )}
        <div className="mt-6">
          {loading ? (
            <div className="p-3">Carregando...</div>
          ) : items.length === 0 ? (
            <div className="p-3">Nenhum lançamento.</div>
          ) : (
            <div className="space-y-6">
              {groupsByMonth.map(g => (
                <div key={g.key}>
                  <div className="font-semibold text-sm text-gray-700 dark:text-gray-200 mb-2 capitalize">{g.label}</div>
                  <table className="w-full">
                    <thead>
                      <tr className="text-left">
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Valor</th>
                        <th className="p-3">Data</th>
                        <th className="p-3">Pagante</th>
                        <th className="p-3">Uso da despesa</th>
                        <th className="p-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map(i => (
                        <tr key={i.id} className="border-t">
                          <td className="p-3 capitalize dark:text-gray-100">{labelTipo(i.tipo)}</td>
                          <td className="p-3 text-black">R$ {Number(i.valor).toFixed(2)}</td>
                          <td className="p-3 dark:text-gray-100">{formatBR(i.data)}</td>
                          <td className="p-3 dark:text-gray-100">{i.pagante || ''}</td>
                          <td className="p-3 dark:text-gray-100">{i.tipo === 'despesa' ? (i.uso || '') : ''}</td>
                          <td className="p-3">
                            <button onClick={() => handleDelete(i)} className="btn-neon">Excluir</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={() => setShowForm(s => !s)} className="btn-neon">Adicionar lançamento</button>
          <button onClick={handleExport} className="btn-neon">Exportar</button>
          <button onClick={handlePrintPDF} className="btn-neon">Imprimir PDF</button>
          <select value={deleteTipo} onChange={e => setDeleteTipo(e.target.value)} className="input">
            <option value="">Excluir por tipo...</option>
            {tiposDisponiveis.map(t => (
              <option key={t} value={t}>{labelTipo(t)}</option>
            ))}
          </select>
          <button onClick={handleDeleteByTipo} disabled={!deleteTipo} className="btn-neon">Excluir por tipo</button>
        </div>
      </div>
    </div>
  )
}