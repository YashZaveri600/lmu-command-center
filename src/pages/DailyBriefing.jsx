import React, { useState, useEffect } from 'react'
import { Sun, Sunset, Moon, Flame, Calendar, BookOpen, Mail, CheckSquare, TrendingUp, Sparkles, Loader2 } from 'lucide-react'
import { getCourseInfo } from '../hooks/useData'
import CourseBadge from '../components/CourseBadge'
import { dailyPlan, currentSemesterProgress } from '../utils/dailyPlan'
import { Skel, SkelStatGrid, SkelPage } from '../components/Skeleton'

const API = import.meta.env.DEV
  ? `http://${window.location.hostname}:3001/api`
  : '/api'

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return { text: 'Good morning', icon: <Sun size={28} className="text-yellow-500" /> }
  if (hour < 17) return { text: 'Good afternoon', icon: <Sunset size={28} className="text-orange-500" /> }
  return { text: 'Good evening', icon: <Moon size={28} className="text-indigo-400" /> }
}

function formatDateNice(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

function isThisWeek(date) {
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)
  return date >= startOfWeek && date < endOfWeek
}

export default function DailyBriefing({ updates, todos, emails, courses, schedule, semester, studySessions, onNavigate, user }) {
  const [aiBriefing, setAiBriefing] = useState(null)
  const [loadingBriefing, setLoadingBriefing] = useState(false)
  const [briefingUnavailable, setBriefingUnavailable] = useState(false)

  useEffect(() => {
    if (!courses?.length) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    let active = true
    setLoadingBriefing(true)
    setBriefingUnavailable(false)
    fetch(`${API}/ai/briefing`, { credentials: 'include', signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        if (!active) return
        if (data.ok && data.briefing) setAiBriefing(data.briefing)
        else setBriefingUnavailable(true)
      })
      .catch(() => { if (active) setBriefingUnavailable(true) })
      .finally(() => { clearTimeout(timeout); if (active) setLoadingBriefing(false) })
    return () => { active = false; clearTimeout(timeout); controller.abort() }
  }, [courses?.length])

  if (!courses) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skel className="h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <Skel className="h-8 w-64" />
            <Skel className="h-3 w-48" />
          </div>
        </div>
        <SkelStatGrid />
        <SkelPage title={false} rows={3} kind="card" />
      </div>
    )
  }


  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const greeting = getGreeting()

  // Semester progress
  const semesterProgress = currentSemesterProgress(semester, today)
  const plan = dailyPlan(todos || [], today)

  // Current streak
  const currentStreak = studySessions?.streaks?.current || 0

  // Today's schedule
  const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()]
  const todaySchedule = schedule?.days?.[dayAbbr] || []

  // Use actual assignment due dates, not announcement publication dates.
  const dueToday = plan.today.map(t => ({ ...t, title: t.task, date: t.due?.slice(0,10) }))
  const dueThisWeek = plan.upcoming.map(t => ({ ...t, title: t.task, date: t.due?.slice(0,10) }))

  // Recent announcements (for display separately)
  const recentAnnouncements = (updates || []).filter(u => {
    if (u.type !== 'announcement') return false
    if (!u.date) return false
    const d = new Date(u.date + 'T00:00:00')
    return isThisWeek(d)
  }).slice(0, 5)

  // Important emails
  const importantEmails = (emails || []).filter(e => e.important).slice(0, 5)

  // Pending todos
  const pendingTodos = plan.pending.slice(0, 5)

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      {/* Greeting */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          {greeting.icon}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {greeting.text}{user?.displayName ? `, ${(user.displayName.includes(',') ? user.displayName.split(',')[1].trim() : user.displayName).split(' ')[0]}` : ''}
          </h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400">{formatDateNice(today)}</p>
      </div>

      {courses.length === 0 && <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 text-left">
        <h2 className="text-lg font-semibold mb-2">Your semester starts here.</h2><p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Connect Brightspace to bring your classes and assignments into one place.</p>
        <button onClick={() => onNavigate('settings')} className="bg-blue-600 text-white rounded-lg px-4 py-2 text-sm">Connect my classes</button><a href="/?demo=1" className="ml-4 text-sm text-blue-600 dark:text-blue-400">Try the demo first ↗</a>
      </div>}
      {briefingUnavailable && <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-5">
        <h2 className="font-semibold mb-2">Your day at a glance</h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">{plan.today.length} assignment{plan.today.length === 1 ? '' : 's'} due today. {plan.overdue.length > 0 ? `${plan.overdue.length} overdue. ` : ''}{plan.upcoming.length} coming up in the next 7 days.</p>
        {plan.pending[0] && <p className="text-sm mt-2">Start with: {plan.pending[0].task}</p>}
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">Based on your saved tasks. The AI summary is unavailable right now.</p>
      </div>}
      {/* AI Daily Briefing */}
      {(aiBriefing || loadingBriefing) && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={18} className="text-blue-500" />
            <h3 className="font-semibold text-blue-900 dark:text-blue-300">AI Daily Briefing</h3>
          </div>
          {loadingBriefing ? (
            <div className="flex items-center gap-2 text-sm text-blue-500">
              <Loader2 size={14} className="animate-spin" /> Analyzing your courses...
            </div>
          ) : (
            <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2 leading-relaxed">
              {aiBriefing.split('\n').filter(p => p.trim()).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Semester progress and streak */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {semesterProgress !== null && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={18} className="text-blue-500" />
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Semester Progress</h3>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
              <div
                className="h-3 rounded-full bg-blue-500 transition-all duration-500"
                style={{ width: `${semesterProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300">{semesterProgress.toFixed(0)}% complete</p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-3">
            <Flame size={18} className="text-orange-500" />
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Study Streak</h3>
          </div>
          <p className="text-4xl font-bold text-gray-900 dark:text-white">{currentStreak} <span className="text-lg font-normal text-gray-400">day{currentStreak !== 1 ? 's' : ''}</span></p>
        </div>
      </div>

      {/* Today's Classes */}
      {todaySchedule.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={18} className="text-purple-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Today's Classes</h3>
          </div>
          <div className="space-y-3">
            {todaySchedule.map((cls, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <CourseBadge courseId={cls.course} courses={courses} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{getCourseInfo(courses, cls.course).name}</p>
                  {cls.location && <p className="text-xs text-gray-500 dark:text-gray-400">{cls.location}</p>}
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{cls.time} - {cls.endTime}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Due Today */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-red-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Due Today</h3>
          </div>
          {dueToday.length > 0 && (
            <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-xs font-medium">
              {dueToday.length}
            </span>
          )}
        </div>
        {dueToday.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No pending assignments due today in your saved data.</p>
        ) : (
          <div className="space-y-2">
            {dueToday.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                <CourseBadge courseId={item.course} courses={courses} />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{item.title}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Next 7 Days */}
      {dueThisWeek.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-yellow-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Next 7 Days</h3>
            </div>
            <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400 rounded-full text-xs font-medium">
              {dueThisWeek.length}
            </span>
          </div>
          <div className="space-y-2">
            {dueThisWeek.map((item, i) => {
              const d = new Date(item.date + 'T00:00:00')
              return (
                <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                  <CourseBadge courseId={item.course} courses={courses} />
                  <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{item.title}</span>
                  <span className="text-xs text-gray-400">{d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Important Emails */}
      {importantEmails.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Mail size={18} className="text-blue-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Important Emails</h3>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('emails')}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              View all
            </button>
          </div>
          <div className="space-y-2">
            {importantEmails.map((email, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                {email.course && <CourseBadge courseId={email.course} courses={courses} />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{email.subject}</p>
                  <p className="text-xs text-gray-400 truncate">{email.from}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Tasks */}
      {pendingTodos.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CheckSquare size={18} className="text-green-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Pending Tasks</h3>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('todos')}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              View all
            </button>
          </div>
          <div className="space-y-2">
            {pendingTodos.map((todo, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  todo.priority === 'high' ? 'bg-red-500' : todo.priority === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'
                }`} />
                <CourseBadge courseId={todo.course} courses={courses} />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{todo.task}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
