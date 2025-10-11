import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const devBypass = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'
    if (devBypass) {
      setSession({ user: { id: 'dev-user', email: 'dev@example.com' } })
      setLoading(false)
      return
    }

    const currentSession = supabase.auth.getSession()
    currentSession.then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signOut() {
    try {
      await supabase.auth.signOut()
      setSession(null)
    } catch (e) {
      console.error('Erro ao sair:', e)
    }
  }

  const value = { session, user: session?.user || null, loading, signOut }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  return useContext(AuthContext)
}