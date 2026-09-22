import React, { useState, useEffect, lazy } from 'react'
import LoginPage from './pages/LoginPage'
import { ToastProvider } from './components/Toast'
import { useDarkMode } from './hooks/useDarkMode'
const AuthenticatedApp = lazy(() => import('./AuthenticatedApp'))
const DemoPage = lazy(() => import('./pages/DemoPage'))
const API = import.meta.env.VITE_API_URL || ''
function LoadingView() {
  return <div className="min-h-screen flex items-center justify-center bg-gray-50 text-gray-600" role="status">Opening your workspace…</div>
}

export default function App() {
  const [authState, setAuthState] = useState('loading') // 'loading' | 'authenticated' | 'unauthenticated'
  const [user, setUser] = useState(null)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [page, setPage] = useState('briefing')
  const [dark, toggleDark] = useDarkMode()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const publicView = new URLSearchParams(window.location.search)
  const isDemo = publicView.get('demo') === '1'
  const isWelcome = publicView.get('welcome') === '1'

  // Check auth on mount
  useEffect(() => {
    if (isDemo || isWelcome) return
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    fetch(`${API}/api/auth/me`, { credentials: 'include', signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (data.authenticated) {
          setAuthState('authenticated')
          setUser(data.user)
          setEmailEnabled(data.emailEnabled || false)
        } else {
          setAuthState('unauthenticated')
        }
      })
      .catch(() => setAuthState('unauthenticated'))
      .finally(() => clearTimeout(timer))
    return () => { clearTimeout(timer); controller.abort() }
  }, [])

  if (isDemo) return <React.Suspense fallback={<LoadingView />}><DemoPage /></React.Suspense>
  if (isWelcome) return <LoginPage />

  // Show loading spinner while checking auth
  if (authState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading EduSync...</p>
        </div>
      </div>
    )
  }

  // Show login page if not authenticated
  if (authState === 'unauthenticated') {
    const hasError = window.location.search.includes('auth_error')
    return <LoginPage error={hasError} />
  }

  // Authenticated — render the app
  return (
    <ToastProvider>
      <React.Suspense fallback={<LoadingView />}><AuthenticatedApp user={user} emailEnabled={emailEnabled} setAuthState={setAuthState} page={page} setPage={setPage} dark={dark} toggleDark={toggleDark} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} /></React.Suspense>
    </ToastProvider>
  )
}
