import React, { useState } from 'react'
import CourseBadge from '../components/CourseBadge'
import UrgencyDot from '../components/UrgencyDot'

export default function Updates({ updates, courses }) {
  const [filter, setFilter] = useState('all')
  const [courseFilter, setCourseFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)

  if (!updates || !courses) return null

  // Only show announcements from current courses (filter out old/junk course IDs)
  const courseIds = new Set(courses.map(c => c.id))
  let filtered = updates.filter(u => courseIds.has(u.course))
  if (filter !== 'all') filtered = filtered.filter(u => u.urgency === filter)
  if (courseFilter !== 'all') filtered = filtered.filter(u => u.course === courseFilter)

  filtered.sort((a, b) => {
    const order = { urgent: 0, upcoming: 1, info: 2 }
    return (order[a.urgency] ?? 3) - (order[b.urgency] ?? 3)
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Brightspace Updates</h2>

      <div className="flex flex-wrap gap-2">
        {['all', 'urgent', 'upcoming', 'info'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
              filter === f
                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <span className="border-l border-gray-300 dark:border-gray-600 mx-1" />
        <select
          value={courseFilter}
          onChange={e => setCourseFilter(e.target.value)}
          className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300"
        >
          <option value="all">All Courses</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map(item => (
          <div
            key={item.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => setExpanded(expanded === item.id ? null : item.id)}
          >
            <div className="flex items-center gap-3">
              <UrgencyDot level={item.urgency} />
              <CourseBadge courseId={item.course} courses={courses} />
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                {item.type}
              </span>
              <span className="flex-1 font-medium text-sm text-gray-900 dark:text-white">{item.title}</span>
              <span className="text-xs text-gray-400">{formatDate(item.date)}</span>
            </div>
            {expanded === item.id && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 pl-4 border-l-2 border-gray-200 dark:border-gray-600">
                {item.detail}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
