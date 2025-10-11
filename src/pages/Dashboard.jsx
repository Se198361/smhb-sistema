import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [avisos, setAvisos] = useState([])
  const [index, setIndex] = useState(0)
  const [animIn, setAnimIn] = useState(true)
  const [financeLoading, setFinanceLoading] = useState(true)
  const [totalReceitas, setTotalReceitas] = useState(0)
  const [totalDespesas, setTotalDespesas] = useState(0)
  const [saldo, setSaldo] = useState(0)
  const [upcomingBirthdays, setUpcomingBirthdays] = useState([])
  const [upcomingEvents, setUpcomingEvents] = useState([])

  function formatBR(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const yyyy = d.getFullYear()
    return `${dd}/${mm}/${yyyy}`
  }

  function formatTime(hhmm) {
    if (!hhmm) return ''
    const [h, m] = String(hhmm).split(':')
    if (!h || !m) return String(hhmm)
    return `${h.padStart(2,'0')}:${m.padStart(2,'0')}`
  }

  async function loadUpcomingEvents() {
    try {
      const readLocal = () => {
        const raw = localStorage.getItem('eventos-list')
        const list = raw ? JSON.parse(raw) : []
        return Array.isArray(list) ? list : []
      }
      let list = readLocal()
      // Se Supabase estiver presente, tenta buscar para sincronizar, mas cai para local
      if (supabase.from) {
        try {
          const { data: rows, error } = await supabase
            .from('eventos')
            .select('*')
            .order('data', { ascending: true })
          if (!error && Array.isArray(rows)) {
            list = rows
            try { localStorage.setItem('eventos-list', JSON.stringify(rows)) } catch {}
          }
        } catch (err) {
          console.warn('Supabase indisponível ao carregar eventos. Usando localStorage.', err)
        }
      }
      const todayMid = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()).getTime()
      const toDateTime = (ev) => {
        const base = ev?.data ? String(ev.data) : ''
        const time = ev?.horario ? String(ev.horario) : ''
        const iso = time ? `${base}T${time}` : base
        const d = new Date(iso)
        return Number.isNaN(d.getTime()) ? new Date(ev?.data) : d
      }
      const upcoming = list
        .filter(e => e && e.titulo && e.data)
        .map(e => ({ ...e, dataObj: toDateTime(e) }))
        .filter(e => !Number.isNaN(e.dataObj.getTime()) && e.dataObj.getTime() >= todayMid)
        .sort((a, b) => a.dataObj.getTime() - b.dataObj.getTime())
        .slice(0, 5)
      setUpcomingEvents(upcoming)
    } catch (e) {
      console.warn('Falha ao carregar eventos próximos:', e)
      setUpcomingEvents([])
    }
  }

  function resolveCreatedDate(a) {
    return a?.criadoEm || a?.created_at || a?.createdAt || a?.created || a?.inserted_at || ''
  }

  function nextBirthdayDate(iso) {
    if (!iso) return null
    let month, day
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) {
      const [y, m, dd] = String(iso).split('-')
      month = Number(m)
      day = Number(dd)
    } else {
      month = d.getMonth() + 1
      day = d.getDate()
    }
    if (!month || !day) return null
    const today = new Date()
    const year = today.getFullYear()
    const candidate = new Date(year, month - 1, day)
    const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    if (candidate < todayMid) candidate.setFullYear(year + 1)
    return candidate
  }

  function loadBirthdays() {
    try {
      const raw = localStorage.getItem('membros-list')
      const list = raw ? JSON.parse(raw) : []
      const today = new Date()
      const msDay = 24 * 60 * 60 * 1000
      const upcoming = list
        .filter(m => m && m.nome && m.aniversario)
        .map(m => {
          const next = nextBirthdayDate(m.aniversario)
          if (!next) return null
          const days = Math.ceil((next.getTime() - today.getTime()) / msDay)
          return { nome: m.nome, data: next, dias: days }
        })
        .filter(Boolean)
        .sort((a, b) => a.data.getTime() - b.data.getTime())
        .slice(0, 5)
      setUpcomingBirthdays(upcoming)
    } catch (e) {
      console.warn('Falha ao carregar aniversariantes:', e)
      setUpcomingBirthdays([])
    }
  }

  useEffect(() => {
    let cancelled = false
    async function fetchAvisos() {
      try {
        if (supabase.from) {
          const { data, error } = await supabase
            .from('avisos')
            .select('*')
            .order('id', { ascending: false })
            .limit(10)
          if (error) throw error
          if (!cancelled) setAvisos(data || [])
        } else {
          // Fallback para localStorage quando supabase não está configurado
          const raw = localStorage.getItem('avisos-list')
          const list = raw ? JSON.parse(raw) : []
          if (!cancelled) setAvisos(Array.isArray(list) ? list.slice(0, 10) : [])
        }
      } catch (e) {
        console.error('Erro ao carregar avisos recentes:', e)
      }
    }
    fetchAvisos()
    const refetch = setInterval(fetchAvisos, 15000)
    return () => { cancelled = true; clearInterval(refetch) }
  }, [])

  useEffect(() => {
    loadBirthdays()
    loadUpcomingEvents()
    const onUpdated = () => loadBirthdays()
    const onStorage = (e) => { if (e && e.key === 'membros-list') loadBirthdays() }
    window.addEventListener('membros:updated', onUpdated)
    window.addEventListener('storage', onStorage)
    const onEventsUpdated = () => loadUpcomingEvents()
    const onEventsStorage = (e) => { if (e && e.key === 'eventos-list') loadUpcomingEvents() }
    window.addEventListener('eventos:updated', onEventsUpdated)
    window.addEventListener('storage', onEventsStorage)
    return () => {
      window.removeEventListener('membros:updated', onUpdated)
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('eventos:updated', onEventsUpdated)
      window.removeEventListener('storage', onEventsStorage)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function fetchFinance() {
      try {
        if (!cancelled) setFinanceLoading(true)
        const fallbackLocal = () => {
          const raw = localStorage.getItem('financas-list')
          return raw ? JSON.parse(raw) : []
        }
        let data = []
        if (supabase.from) {
          try {
            const { data: rows, error } = await supabase
              .from('financas')
              .select('tipo,valor')
            if (error) throw error
            data = Array.isArray(rows) ? rows : fallbackLocal()
          } catch (err) {
            console.warn('Supabase indisponível, usando localStorage:', err)
            data = fallbackLocal()
          }
        } else {
          data = fallbackLocal()
        }
        const toNum = (v) => {
          if (typeof v === 'string') {
            const n = Number(v.replace(/\./g, '').replace(',', '.'))
            return Number.isNaN(n) ? 0 : n
          }
          const n = Number(v || 0)
          return Number.isNaN(n) ? 0 : n
        }
        const receitas = data.filter(i => String(i.tipo) !== 'despesa').reduce((acc, i) => acc + toNum(i.valor), 0)
        const despesas = data.filter(i => String(i.tipo) === 'despesa').reduce((acc, i) => acc + toNum(i.valor), 0)
        if (!cancelled) {
          setTotalReceitas(receitas)
          setTotalDespesas(despesas)
          setSaldo(receitas - despesas)
        }
      } catch (e) {
        console.error('Erro ao carregar finanças:', e)
      } finally {
        if (!cancelled) setFinanceLoading(false)
      }
    }
    fetchFinance()
    const refetch = setInterval(fetchFinance, 20000)
    const onUpdated = () => fetchFinance()
    const onStorage = (e) => { if (e && e.key === 'financas-list') fetchFinance() }
    window.addEventListener('financas:updated', onUpdated)
    window.addEventListener('storage', onStorage)
    return () => { cancelled = true; clearInterval(refetch); window.removeEventListener('financas:updated', onUpdated); window.removeEventListener('storage', onStorage) }
  }, [])

  useEffect(() => {
    if (!avisos.length) return
    setIndex(0)
    setAnimIn(true)
    const interval = setInterval(() => {
      setAnimIn(false)
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % avisos.length)
        setAnimIn(true)
      }, 450) // tempo de saída antes da entrada
    }, 4000)
    return () => clearInterval(interval)
  }, [avisos])

  const current = avisos.length ? avisos[index] : null

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="card">
        <h2 className="font-montserrat font-semibold text-primary dark:text-light">Resumo Financeiro</h2>
        {financeLoading ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">Carregando...</p>
        ) : (
          <div className="mt-2">
            <p className="text-xs text-gray-600 dark:text-gray-300">Em caixa atual</p>
            <p className={`text-lg font-semibold ${saldo >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>R$ {saldo.toFixed(2)}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Receitas: R$ {totalReceitas.toFixed(2)} | Despesas: R$ {totalDespesas.toFixed(2)}</p>
          </div>
        )}
      </div>
      <div className="card">
        <h2 className="font-montserrat font-semibold text-primary dark:text-light">Eventos Próximos</h2>
        {upcomingEvents.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">Nenhum evento próximo</p>
        ) : (
          <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc ml-6">
            {upcomingEvents.map((e) => (
              <li key={`${e.id}-${e.data}-${e.horario || ''}`}>
                <span className="dark:text-gray-100 font-medium">{e.titulo}</span> — {formatBR(e.dataObj)}{e.horario ? ` ${formatTime(e.horario)}h` : ''}
                {e.local ? <span className="text-xs text-gray-500 dark:text-gray-400"> • {e.local}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="card">
        <h2 className="font-montserrat font-semibold text-primary dark:text-light">Aniversariantes</h2>
        {upcomingBirthdays.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">Nenhum aniversariante próximo</p>
        ) : (
          <ul className="text-sm text-gray-600 dark:text-gray-300 list-disc ml-6">
            {upcomingBirthdays.map((b) => (
              <li key={`${b.nome}-${b.data.toISOString()}`}>
                <span className="dark:text-gray-100">{b.nome}</span> — {formatBR(b.data)}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="md:col-span-3 card">
        <h2 className="font-montserrat font-semibold text-primary dark:text-light">Avisos Recentes</h2>
        {!current ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">Sem avisos por enquanto</p>
        ) : (
          <div className="mt-2 overflow-hidden h-14">
            <style>{`
              @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
              @keyframes fadeSlideOut { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(-6px); } }
              .ticker-in { animation: fadeSlideIn 0.45s ease forwards; }
              .ticker-out { animation: fadeSlideOut 0.45s ease forwards; }
            `}</style>
            <div className={`${animIn ? 'ticker-in' : 'ticker-out'} flex items-center justify-between`}> 
              <span className="font-medium dark:text-gray-100 truncate max-w-[70%]">{current.titulo}</span>
              <span className="text-xs text-gray-500 dark:text-gray-400">Criado em: {formatBR(resolveCreatedDate(current))}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}