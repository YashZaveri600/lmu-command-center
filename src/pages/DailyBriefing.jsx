import React from 'react'
import { Sun, Sunset, Moon, Flame, Calendar, BookOpen, Mail, CheckSquare, TrendingUp } from 'lucide-react'
import { getCourseInfo } from '../hooks/useData'
import CourseBadge from '../components/CourseBadge'

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

export default function DailyBriefing({ updates, todos, emails, courses, schedule, semester, studySessions, onNavigate }) {
  if (!courses) return null

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const greeting = getGreeting()

  // Semester progress
  let semesterProgress = null
  if (semester && semester.startDate && semester.endDate) {
    const start = new Date(semester.startDate + 'T00:00:00')
    const end = new Date(semester.endDate + 'T00:00:00')
    const total = end - start
    const elapsed = today - start
    semesterProgress = Math.max(0, Math.min(100, (elapsed / total) * 100))
  }

  // Current streak
  const currentStreak = studySessions?.streaks?.current || 0

  // Today's schedule
  const dayAbbr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()]
  const todaySchedule = schedule?.days?.[dayAbbr] || []

  // Due today — only assignments, not announcements
  const dueToday = (updates || []).filter(u => u.date === todayStr && u.type === 'assignment')

  // Due this week — only assignments, not announcements
  const dueThisWeek = (updates || []).filter(u => {
    if (!u.date || u.type === 'announcement') return false
    const d = new Date(u.date + 'T00:00:00')
    return isThisWeek(d) && u.date !== todayStr
  })

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
  const pendingTodos = (todos || []).filter(t => !t.done).slice(0, 5)

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      {/* Greeting */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          {greeting.icon}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {greeting.text}, Yash
          </h1>
        </div>
        <p className="text-gray-500 dark:text-gray-400">{formatDateNice(today)}</p>
      </div>

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
          <p className="text-sm text-gray-400 dark:text-gray-500">Nothing due today. Enjoy the breathing room.</p>
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

      {/* Due This Week */}
      {dueThisWeek.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-yellow-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Due This Week</h3>
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
