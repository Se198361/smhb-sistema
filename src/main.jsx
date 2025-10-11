import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import './index.css'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Cadastro from './pages/Cadastro.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Membros from './pages/Membros.jsx'
import Celulas from './pages/Celulas.jsx'
import Financas from './pages/Financas.jsx'
import Eventos from './pages/Eventos.jsx'
import Conteudo from './pages/Conteudo.jsx'
import Avisos from './pages/Avisos.jsx'
import Crachas from './pages/Crachas.jsx'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="text-center">Carregando...</div>
  return user ? children : <Navigate to="/login" />
}

function ErrorBoundary({ children }) {
  return (
    <ErrorBoundaryImpl>
      {children}
    </ErrorBoundaryImpl>
  )
}

class ErrorBoundaryImpl extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error, info) {
    console.error('Erro renderizando app:', error, info)
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24 }}>
          <h1>Ocorreu um erro</h1>
          <p>Tente recarregar a página. Se persistir, nos envie o log do Console.</p>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <ErrorBoundary>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Navigate to="/dashboard" />} />
              <Route path="/login" element={<Login />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/membros" element={<PrivateRoute><Membros /></PrivateRoute>} />
              <Route path="/diretoria" element={<PrivateRoute><Celulas /></PrivateRoute>} />
              <Route path="/financas" element={<PrivateRoute><Financas /></PrivateRoute>} />
              <Route path="/eventos" element={<PrivateRoute><Eventos /></PrivateRoute>} />
              <Route path="/conteudo" element={<PrivateRoute><Conteudo /></PrivateRoute>} />
              <Route path="/avisos" element={<PrivateRoute><Avisos /></PrivateRoute>} />
              <Route path="/crachas" element={<PrivateRoute><Crachas /></PrivateRoute>} />
            </Route>
          </Routes>
        </HashRouter>
      </ErrorBoundary>
    </AuthProvider>
  </StrictMode>,
)
