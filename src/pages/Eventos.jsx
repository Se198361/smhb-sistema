import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Eventos() {
  const [eventos, setEventos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [data, setData] = useState('')
  const [horario, setHorario] = useState('')
  const [local, setLocal] = useState('')
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    async function load() {
      try {
        if (supabase.from) {
          try {
            const { data: rows, error } = await supabase
              .from('eventos')
              .select('*')
              .order('data', { ascending: true })
            if (error) throw error
            setEventos(rows || [])
            try { localStorage.setItem('eventos-list', JSON.stringify(rows || [])) } catch {}
          } catch (err) {
            console.warn('Supabase indisponível ou tabela "eventos" ausente. Usando localStorage.', err)
            const raw = localStorage.getItem('eventos-list')
            const list = raw ? JSON.parse(raw) : []
            setEventos(Array.isArray(list) ? list : [])
          }
        } else {
          const raw = localStorage.getItem('eventos-list')
          const list = raw ? JSON.parse(raw) : []
          setEventos(Array.isArray(list) ? list : [])
        }
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function eventDateTime(ev) {
    try {
      const base = ev?.data ? String(ev.data) : ''
      const time = ev?.horario ? String(ev.horario) : ''
      const iso = time ? `${base}T${time}` : base
      const d = new Date(iso)
      return d
    } catch {
      try { return new Date(ev?.data) } catch { return new Date() }
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!titulo.trim() || !data || !horario || !local.trim()) {
      alert('Informe título, data, horário e local do evento.')
      return
    }
    try {
      if (editingId !== null) {
        // Atualiza evento existente
        let updated = { id: editingId, titulo, data, horario, local }
        if (supabase.from) {
          try {
            const { data: rows, error } = await supabase
              .from('eventos')
              .update({ titulo, data, horario, local })
              .eq('id', editingId)
              .select('*')
            if (!error && Array.isArray(rows) && rows[0]) updated = rows[0]
          } catch (err) {
            console.warn('Falha ao atualizar no Supabase, seguirá com localStorage:', err)
          }
        }
        setEventos(prev => {
          const next = prev.map(ev => ev.id === editingId ? { ...ev, ...updated } : ev)
          next.sort((a, b) => eventDateTime(a) - eventDateTime(b))
          try { localStorage.setItem('eventos-list', JSON.stringify(next)) } catch {}
          try { window.dispatchEvent(new CustomEvent('eventos:updated')) } catch {}
          return next
        })
      } else {
        // Cria novo evento
        let novo = { id: Date.now(), titulo, data, horario, local }
        if (supabase.from) {
          try {
            const { data: insertedData, error } = await supabase
              .from('eventos')
              .insert([{ titulo, data, horario, local }])
              .select('*')
            if (error) throw error
            const inserted = Array.isArray(insertedData) ? insertedData[0] : insertedData
            if (inserted) novo = inserted
          } catch (err) {
            console.warn('Falha ao inserir no Supabase, usando localStorage:', err)
          }
        }
        setEventos(prev => {
          const next = [...prev, novo]
          next.sort((a, b) => eventDateTime(a) - eventDateTime(b))
          try { localStorage.setItem('eventos-list', JSON.stringify(next)) } catch {}
          try { window.dispatchEvent(new CustomEvent('eventos:updated')) } catch {}
          return next
        })
      }
      setTitulo('')
      setData('')
      setHorario('')
      setLocal('')
      setEditingId(null)
      setShowForm(false)
    } catch (err) {
      alert('Erro ao salvar evento: ' + (err?.message || 'tente novamente'))
    }
  }

  async function handleDelete(id) {
    if (!id) return
    try {
      if (supabase.from) {
        try {
          const { error } = await supabase
            .from('eventos')
            .delete()
            .eq('id', id)
          if (error) console.warn('Erro ao excluir no Supabase, seguirá com localStorage:', error)
        } catch (err) {
          console.warn('Falha ao excluir no Supabase, seguirá com localStorage:', err)
        }
      }
      setEventos(prev => {
        const next = prev.filter(e => e.id !== id)
        next.sort((a, b) => eventDateTime(a) - eventDateTime(b))
        try { localStorage.setItem('eventos-list', JSON.stringify(next)) } catch {}
        try { window.dispatchEvent(new CustomEvent('eventos:updated')) } catch {}
        return next
      })
    } catch (err) {
      alert('Erro ao excluir evento: ' + (err?.message || 'tente novamente'))
    }
  }

  function startEdit(ev) {
    if (!ev) return
    try {
      setEditingId(ev.id)
      setTitulo(ev.titulo || '')
      setData(ev.data || '')
      setHorario(ev.horario || '')
      setLocal(ev.local || '')
      setShowForm(true)
    } catch {}
  }
  return (
    <div className="space-y-6">
      <h1 className="font-montserrat text-2xl font-bold text-primary dark:text-light">Eventos</h1>
      <div className="card p-0">
        <table className="w-full">
          <thead>
            <tr className="text-left">
              <th className="p-3">Título</th>
              <th className="p-3">Data</th>
              <th className="p-3">Horário</th>
              <th className="p-3">Local</th>
              <th className="p-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="p-3" colSpan={5}>Carregando...</td></tr>
            ) : eventos.length === 0 ? (
              <tr><td className="p-3" colSpan={5}>Nenhum evento cadastrado.</td></tr>
            ) : eventos.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-3 dark:text-gray-100">{e.titulo}</td>
                <td className="p-3 dark:text-gray-100">{e.data}</td>
                <td className="p-3 dark:text-gray-100">{e.horario || ''}</td>
                <td className="p-3 dark:text-gray-100">{e.local}</td>
                <td className="p-3">
                  <div className="flex gap-2">
                    <button className="btn-neon text-sm px-3 py-1" onClick={() => startEdit(e)}>Editar</button>
                    <button className="btn-neon text-sm px-3 py-1" onClick={() => handleDelete(e.id)}>Excluir</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm ? (
        <form onSubmit={handleAdd} className="card space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-200">Título</label>
            <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)} className="w-full" placeholder="Ex.: Culto de Domingo" />
          </div>
          <div className="grid md:grid-cols-4 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Data</label>
              <input type="date" value={data} onChange={e => setData(e.target.value)} className="w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Horário</label>
              <input type="time" value={horario} onChange={e => setHorario(e.target.value)} className="w-full" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1 dark:text-gray-200">Local</label>
              <input type="text" value={local} onChange={e => setLocal(e.target.value)} className="w-full" placeholder="Ex.: Santuário" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn-neon">Salvar</button>
            <button type="button" className="btn-neon" onClick={() => { setShowForm(false); setTitulo(''); setData(''); setHorario(''); setLocal(''); setEditingId(null); }}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button className="btn-neon" onClick={() => { setShowForm(true); setEditingId(null); }}>Novo Evento</button>
      )}
    </div>
  )
}