import { createClient } from '@supabase/supabase-js'

// Espera chaves em .env: VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabase

if (typeof supabaseUrl === 'string' && supabaseUrl && typeof supabaseAnonKey === 'string' && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
  console.warn('Supabase: variáveis de ambiente ausentes. Usando cliente mock para evitar falhas.')
  const mockAuth = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: (_event, _cb) => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: async () => ({ data: null, error: new Error('Supabase não configurado') }),
    signOut: async () => ({ error: null }),
  }
  // manter apenas auth para que páginas detectem ausência de supabase.from
  supabase = { auth: mockAuth }
}

export { supabase }