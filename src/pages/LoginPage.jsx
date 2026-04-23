import React from 'react'
import { BookOpen, CheckSquare, Bell, Award, Calendar, Shield } from 'lucide-react'

const FEATURES = [
  { icon: BookOpen, label: 'Course files + assignments' },
  { icon: CheckSquare, label: 'Auto-completing to-dos' },
  { icon: Bell, label: 'All announcements, one feed' },
  { icon: Award, label: 'Grades + What-If calculator' },
  { icon: Calendar, label: 'Unified class + deadline calendar' },
  { icon: Shield, label: 'Read-only, private, encrypted' },
]

export default function LoginPage({ error }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-950 via-gray-900 to-purple-950 px-4 py-12">
      <div className="max-w-md w-full">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 mb-4 shadow-2xl shadow-purple-500/30">
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
            className="flex items-center justify-center gap-3 w-full py-3 px-4 bg-white hover:bg-gray-100 text-gray-900 font-medium rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl active:scale-[0.99]"
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
              <Shield size={16} className="mt-0.5 flex-shrink-0" />
              <span>
                Read-only integration. Your data stays private, encrypted, and is never shared with third parties.
              </span>
            </div>
          </div>
        </div>

        {/* Feature preview */}
        <div className="mt-8 grid grid-cols-2 gap-3">
          {FEATURES.map(({ icon: Icon, label }, i) => (
            <div
              key={i}
              className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-300"
            >
              <Icon size={14} className="text-blue-400 flex-shrink-0" />
              <span className="truncate">{label}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-gray-600 text-xs mt-6">
          Built by students, for students
        </p>
      </div>
    </div>
  )
}
