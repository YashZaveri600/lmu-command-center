import React from 'react'
import { Target } from 'lucide-react'
import CourseBadge from '../components/CourseBadge'
import UrgencyDot from '../components/UrgencyDot'

export default function FocusMode({ updates, todos, courses }) {
  if (!updates || !todos || !courses) return null

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()))
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  const dueTodayUpdates = updates.filter(u => u.date === todayStr && u.type === 'assignment')
  const dueThisWeek = updates.filter(u => u.type === 'assignment' && u.date > todayStr && u.date <= weekEndStr)
  const todosDueToday = todos.filter(t => !t.done && t.due === todayStr)
  const todosDueThisWeek = todos.filter(t => !t.done && t.due > todayStr && t.due <= weekEndStr)

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  todosDueToday.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
  todosDueThisWeek.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])

  const dayName = today.toLocaleDateString('en-US', { weekday: 'long' })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Target size={24} className="text-blue-500" />
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Focus Mode</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {dayName} — here's what needs your attention
          </p>
        </div>
      </div>

      {/* Due Today */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Due Today</h3>
        {dueTodayUpdates.length === 0 && todosDueToday.length === 0 ? (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="text-sm text-green-700 dark:text-green-300">Nothing due today. You're in the clear.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dueTodayUpdates.map(u => (
              <div key={u.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center gap-3">
                <UrgencyDot level={u.urgency} />
                <CourseBadge courseId={u.course} courses={courses} />
                <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{u.title}</span>
                <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded font-medium">Today</span>
              </div>
            ))}
            {todosDueToday.map(t => (
              <div key={t.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${t.priority === 'high' ? 'bg-red-500' : t.priority === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
                <CourseBadge courseId={t.course} courses={courses} />
                <span className="text-sm text-gray-900 dark:text-white flex-1">{t.task}</span>
                <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded font-medium">Today</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Due This Week */}
      <section>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Due This Week</h3>
        {dueThisWeek.length === 0 && todosDueThisWeek.length === 0 ? (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">Nothing else due this week.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dueThisWeek.map(u => (
              <div key={u.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center gap-3">
                <UrgencyDot level={u.urgency} />
                <CourseBadge courseId={u.course} courses={courses} />
                <span className="text-sm font-medium text-gray-900 dark:text-white flex-1">{u.title}</span>
                <span className="text-xs text-gray-400">{formatDate(u.date)}</span>
              </div>
            ))}
            {todosDueThisWeek.map(t => (
              <div key={t.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full ${t.priority === 'high' ? 'bg-red-500' : t.priority === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'}`} />
                <CourseBadge courseId={t.course} courses={courses} />
                <span className="text-sm text-gray-900 dark:text-white flex-1">{t.task}</span>
                <span className="text-xs text-gray-400">{formatDate(t.due)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}
