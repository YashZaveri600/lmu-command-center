import React, { useState, useEffect } from 'react'
import { AlertTriangle, CheckSquare, Clock, Bell, ArrowRight, Timer, BookOpen, ExternalLink } from 'lucide-react'
import CourseBadge from '../components/CourseBadge'
import UrgencyDot from '../components/UrgencyDot'
import { SkelPage, SkelStatGrid } from '../components/Skeleton'

// Pick the best "syllabus" item for a course from the content tree
function findSyllabus(courseContent, courseId) {
  if (!courseContent) return null
  const items = courseContent.filter(c => c.course === courseId)
  // Prefer file/page/link items whose title contains "syllabus"
  const leaf = items.find(
    c => /syllabus/i.test(c.title) && ['file', 'page', 'link', 'pdf'].includes(c.type)
  )
  if (leaf) return leaf
  // Next best: any item whose title contains "syllabus"
  const any = items.find(c => /syllabus/i.test(c.title))
  if (any) return any
  return null
}

export default function Dashboard({ updates, todos, emails, courses, courseContent, onNavigate }) {
  if (!updates || !todos || !emails) {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-gray-200 dark:bg-gray-700/60 animate-pulse rounded" />
          <div className="h-3 w-64 bg-gray-200 dark:bg-gray-700/60 animate-pulse rounded" />
        </div>
        <SkelStatGrid />
        <SkelPage title={false} rows={3} />
      </div>
    )
  }

  const urgentItems = updates.filter(u => u.urgency === 'urgent')
  const pendingTodos = todos.filter(t => !t.done)
  const importantEmails = emails.filter(e => e.important)

  const upcomingDeadlines = [...updates]
    .filter(u => u.type === 'assignment')
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5)

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<AlertTriangle size={20} className="text-red-500" />}
          label="Urgent Items"
          value={urgentItems.length}
          color="red"
          onClick={() => onNavigate('updates')}
        />
        <StatCard
          icon={<CheckSquare size={20} className="text-blue-500" />}
          label="Pending Tasks"
          value={pendingTodos.length}
          color="blue"
          onClick={() => onNavigate('todos')}
        />
        <StatCard
          icon={<Clock size={20} className="text-yellow-500" />}
          label="Upcoming Deadlines"
          value={upcomingDeadlines.length}
          color="yellow"
          onClick={() => onNavigate('updates')}
        />
        <StatCard
          icon={<Bell size={20} className="text-purple-500" />}
          label="Important Emails"
          value={importantEmails.length}
          color="purple"
          onClick={() => onNavigate('emails')}
        />
      </div>

      {/* Urgent items */}
      {urgentItems.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 dark:text-red-300 flex items-center gap-2 mb-3">
            <AlertTriangle size={18} /> Needs Attention
          </h3>
          <div className="space-y-2">
            {urgentItems.map(item => (
              <div key={item.id} className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded p-3">
                <UrgencyDot level="urgent" />
                <CourseBadge courseId={item.course} courses={courses} />
                <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{item.title}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">Due {item.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Countdown timers */}
      <CountdownTimers deadlines={upcomingDeadlines.slice(0, 3)} courses={courses} />

      {/* Syllabi */}
      {courses && courses.length > 0 && (
        <SyllabiRow courses={courses} courseContent={courseContent} onNavigate={onNavigate} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming deadlines */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">Upcoming Deadlines</h3>
            <button onClick={() => onNavigate('updates')} className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {upcomingDeadlines.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                <UrgencyDot level={item.urgency} />
                <CourseBadge courseId={item.course} courses={courses} />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{item.title}</span>
                <span className={`text-xs ${item.date === today ? 'text-red-500 font-semibold' : 'text-gray-400'}`}>
                  {formatDate(item.date)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pending todos */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">This Week's Tasks</h3>
            <button onClick={() => onNavigate('todos')} className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1">
              View all <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {pendingTodos.slice(0, 5).map(item => (
              <div key={item.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                <span className={`w-2 h-2 rounded-full ${
                  item.priority === 'high' ? 'bg-red-500' : item.priority === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'
                }`} />
                <CourseBadge courseId={item.course} courses={courses} />
                <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{item.task}</span>
                <span className="text-xs text-gray-400">{formatDate(item.due)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-left hover:shadow-md transition-shadow"
    >
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </button>
  )
}

function CountdownTimers({ deadlines, courses }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(interval)
  }, [])

  if (!deadlines.length) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {deadlines.map(item => {
        const due = new Date(item.date + 'T23:59:59').getTime()
        const diff = due - now
        const days = Math.floor(diff / 86400000)
        const hours = Math.floor((diff % 86400000) / 3600000)
        const course = courses?.find(c => c.id === item.course)
        const isOverdue = diff < 0
        return (
          <div key={item.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Timer size={14} className="text-gray-400" />
              <CourseBadge courseId={item.course} courses={courses} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 truncate">{item.title}</p>
            <p className={`text-lg font-bold font-mono ${isOverdue ? 'text-red-500' : days === 0 ? 'text-orange-500' : 'text-gray-900 dark:text-white'}`}>
              {isOverdue ? 'OVERDUE' : days === 0 ? `${hours}h left` : `${days}d ${hours}h`}
            </p>
          </div>
        )
      })}
    </div>
  )
}

function SyllabiRow({ courses, courseContent, onNavigate }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <BookOpen size={16} className="text-indigo-500" /> Syllabi
        </h3>
        <button
          onClick={() => onNavigate('files')}
          className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
        >
          Browse all files <ArrowRight size={12} />
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {courses.map(course => {
          const syllabus = findSyllabus(courseContent, course.id)
          const hasLink = syllabus && syllabus.url
          return (
            <a
              key={course.id}
              href={hasLink ? syllabus.url : undefined}
              target={hasLink ? '_blank' : undefined}
              rel={hasLink ? 'noopener noreferrer' : undefined}
              className={`flex items-center gap-2 p-2.5 rounded border text-left transition-colors ${
                hasLink
                  ? 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer'
                  : 'border-gray-100 dark:border-gray-700/60 opacity-60'
              }`}
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: course.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{course.shortCode || course.name}</p>
                <p className="text-xs text-gray-400 truncate">
                  {syllabus ? syllabus.title : 'Syllabus not found'}
                </p>
              </div>
              {hasLink && (
                <ExternalLink size={12} className="text-gray-400 flex-shrink-0" />
              )}
            </a>
          )
        })}
      </div>
    </div>
  )
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
