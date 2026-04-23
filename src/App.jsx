import React, { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from './components/Sidebar'
import SearchBar from './components/SearchBar'
import Dashboard from './pages/Dashboard'
import Updates from './pages/Updates'
import Todos from './pages/Todos'
import Emails from './pages/Emails'
import Schedule from './pages/Schedule'
import Files from './pages/Files'
import Automations from './pages/Automations'
import FocusMode from './pages/FocusMode'
import DailyBriefing from './pages/DailyBriefing'
import Grades from './pages/Grades'
import Notes from './pages/Notes'
import StudyTimer from './pages/StudyTimer'
import CalendarView from './pages/CalendarView'
import LoginPage from './pages/LoginPage'
import SettingsPage from './pages/Settings'
import AiChat from './components/AiChat'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import SyncStatus from './components/SyncStatus'
import { useAPI, useSSE } from './hooks/useData'
import { useDarkMode } from './hooks/useDarkMode'

const API = import.meta.env.VITE_API_URL || ''

export default function App() {
  const [authState, setAuthState] = useState('loading') // 'loading' | 'authenticated' | 'unauthenticated'
  const [user, setUser] = useState(null)
  const [emailEnabled, setEmailEnabled] = useState(false)
  const [page, setPage] = useState('briefing')
  const [dark, toggleDark] = useDarkMode()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Check auth on mount
  useEffect(() => {
    fetch(`${API}/api/auth/me`, { credentials: 'include' })
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
  }, [])

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
      <AuthenticatedApp user={user} emailEnabled={emailEnabled} setAuthState={setAuthState} page={page} setPage={setPage} dark={dark} toggleDark={toggleDark} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />
    </ToastProvider>
  )
}

function AuthenticatedApp({ user, emailEnabled, setAuthState, page, setPage, dark, toggleDark, mobileMenuOpen, setMobileMenuOpen }) {
  const { data: courses, setData: setCourses } = useAPI('courses')
  const { data: courseContent, setData: setCourseContent } = useAPI('course-content')
  const { data: calendarEvents, setData: setCalendarEvents } = useAPI('calendar-events')
  const { data: updates, setData: setUpdates } = useAPI('updates')
  const { data: todos, setData: setTodos } = useAPI('todos')
  const { data: emails, setData: setEmails } = useAPI('emails')
  const { data: schedule } = useAPI('schedule')
  const { data: automations, setData: setAutomations } = useAPI('automations')
  const { data: grades, setData: setGrades } = useAPI('grades')
  const { data: notes, setData: setNotes } = useAPI('notes')
  const { data: studySessions, setData: setStudySessions } = useAPI('study-sessions')
  const { data: semester } = useAPI('semester')

  const handleSSE = useCallback((type, data) => {
    const setters = { updates: setUpdates, todos: setTodos, emails: setEmails, courses: setCourses, automations: setAutomations, grades: setGrades, notes: setNotes, 'study-sessions': setStudySessions, 'course-content': setCourseContent, 'calendar-events': setCalendarEvents }
    if (setters[type]) setters[type](data)
  }, [setUpdates, setTodos, setEmails, setCourses, setAutomations, setGrades, setNotes, setStudySessions, setCourseContent, setCalendarEvents])

  useSSE(handleSSE)

  // Auto-check Brightspace submissions on load + every 2 min while app is open
  useEffect(() => {
    const check = () => fetch(`${API}/api/todos/check-submissions`, { method: 'POST', credentials: 'include' }).catch(() => {})
    check()
    const interval = setInterval(check, 2 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  const urgentCount = updates ? updates.filter(u => u.urgency === 'urgent').length : 0
  const streak = studySessions?.streaks?.current || 0

  const semesterProgress = useMemo(() => {
    if (!semester) return null
    const start = new Date(semester.startDate).getTime()
    const end = new Date(semester.endDate).getTime()
    const now = Date.now()
    return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
  }, [semester])

  useEffect(() => {
    const pending = todos ? todos.filter(t => !t.done).length : 0
    document.title = pending > 0 ? `(${pending}) EduSync` : 'EduSync'
  }, [todos])

  const navigate = (p) => {
    setPage(p)
    setMobileMenuOpen(false)
  }

  const handleLogout = async () => {
    await fetch('/auth/logout', { method: 'POST', credentials: 'include' })
    setAuthState('unauthenticated')
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-30 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="p-2 text-gray-600 dark:text-gray-400">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
            {mobileMenuOpen ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
        <h1 className="text-base font-bold text-gray-900 dark:text-white">EduSync</h1>
        <SyncStatus />
      </div>

      {/* Desktop header (top bar visible on every page) */}
      <div className="hidden lg:flex fixed top-0 right-0 z-20 px-6 py-3 bg-gray-50 dark:bg-gray-950">
        <SyncStatus />
      </div>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-20 transform transition-transform duration-200 lg:relative lg:transform-none ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <Sidebar active={page} onNavigate={navigate} dark={dark} toggleDark={toggleDark} urgentCount={urgentCount} streak={streak} semesterProgress={semesterProgress} user={user} onLogout={handleLogout} />
      </div>
      {mobileMenuOpen && <div className="fixed inset-0 bg-black/30 z-10 lg:hidden" onClick={() => setMobileMenuOpen(false)} />}

      <main className="flex-1 p-4 pt-16 lg:pt-6 lg:p-8 max-w-6xl overflow-y-auto">
        {page !== 'briefing' && <SearchBar courses={courses} onNavigate={navigate} />}

        {page === 'briefing' && <ErrorBoundary label="Daily Briefing"><DailyBriefing updates={updates} todos={todos} emails={emails} courses={courses} schedule={schedule} semester={semester} studySessions={studySessions} onNavigate={navigate} user={user} /></ErrorBoundary>}
        {page === 'dashboard' && <ErrorBoundary label="Dashboard"><Dashboard updates={updates} todos={todos} emails={emails} courses={courses} courseContent={courseContent} onNavigate={navigate} /></ErrorBoundary>}
        {page === 'updates' && <ErrorBoundary label="Brightspace Updates"><Updates updates={updates} courses={courses} /></ErrorBoundary>}
        {page === 'todos' && <ErrorBoundary label="Weekly To-Do"><Todos todos={todos} courses={courses} setTodos={setTodos} /></ErrorBoundary>}
        {page === 'emails' && <ErrorBoundary label="Professor Emails"><Emails emails={emails} courses={courses} /></ErrorBoundary>}
        {page === 'schedule' && <ErrorBoundary label="Class Schedule"><Schedule schedule={schedule} courses={courses} updates={updates} /></ErrorBoundary>}
        {page === 'files' && <ErrorBoundary label="Course Files"><Files courses={courses} courseContent={courseContent} setCourses={setCourses} /></ErrorBoundary>}
        {page === 'automations' && <ErrorBoundary label="Automations"><Automations automations={automations} /></ErrorBoundary>}
        {page === 'focus' && <ErrorBoundary label="Focus Mode"><FocusMode updates={updates} todos={todos} courses={courses} onNavigate={navigate} /></ErrorBoundary>}
        {page === 'grades' && <ErrorBoundary label="Grades & GPA"><Grades grades={grades} courses={courses} setGrades={setGrades} /></ErrorBoundary>}
        {page === 'notes' && <ErrorBoundary label="Quick Notes"><Notes notes={notes} courses={courses} setNotes={setNotes} /></ErrorBoundary>}
        {page === 'study' && <ErrorBoundary label="Study Timer"><StudyTimer studySessions={studySessions} courses={courses} setStudySessions={setStudySessions} /></ErrorBoundary>}
        {page === 'calendar' && <ErrorBoundary label="Calendar"><CalendarView updates={updates} todos={todos} courses={courses} semester={semester} calendarEvents={calendarEvents} /></ErrorBoundary>}
        {page === 'settings' && <ErrorBoundary label="Settings"><SettingsPage user={user} emailEnabled={emailEnabled} /></ErrorBoundary>}
      </main>
      <AiChat />
    </div>
  )
}
