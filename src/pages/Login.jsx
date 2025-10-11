import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else if (data?.session) {
      navigate('/dashboard')
    }
  }

  async function handleResetPassword() {
    setError('')
    if (!email) {
      setError('Informe seu e-mail para recuperar a senha.')
      return
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login',
    })
    if (error) setError(error.message)
    else alert('Enviamos um e-mail com instruções para redefinir sua senha.')
  }

  return (
    <div className="max-w-md mx-auto card">
      <h1 className="font-montserrat text-2xl font-bold mb-4 text-primary dark:text-light">Entrar</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-200">E-mail</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 dark:text-gray-200">Senha</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full" />
        </div>
        {error && <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>}
        <button disabled={loading} className="w-full btn-neon">
          {loading ? 'Entrando...' : 'Entrar'}
        </button>
        <div className="text-right">
          <button type="button" onClick={handleResetPassword} className="text-sm soft-link">Esqueci minha senha</button>
      </div>
      </form>
    </div>
  )
}