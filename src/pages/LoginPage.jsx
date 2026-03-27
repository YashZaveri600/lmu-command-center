import React from 'react'

export default function LoginPage({ error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-gray-900 to-purple-950">
      <div className="max-w-md w-full mx-4">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-2xl">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 10 3 12 0v-5" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">EduSync</h1>
          <p className="mt-2 text-gray-400 text-lg">Your university command center</p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-800/50 backdrop-blur-xl rounded-2xl border border-gray-700/50 p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-2">Welcome</h2>
          <p className="text-gray-400 mb-6">Sign in with your university Microsoft account to get started.</p>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              Sign in failed. Please try again.
            </div>
          )}

          <a
            href="/auth/microsoft"
            className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            {/* Microsoft logo */}
            <svg width="20" height="20" viewBox="0 0 21 21">
              <rect x="1" y="1" width="9" height="9" fill="#f25022" />
              <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
              <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
              <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
            </svg>
            Sign in with Microsoft
          </a>

          <div className="mt-6 pt-6 border-t border-gray-700/50">
            <div className="flex items-start gap-3 text-sm text-gray-500">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mt-0.5 flex-shrink-0">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Works with any university .edu email or personal Microsoft account. Your data stays private and secure.</span>
            </div>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Built by students, for students
        </p>
      </div>
    </div>
  )
}
