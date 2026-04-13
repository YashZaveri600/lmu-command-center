import React, { useState, useCallback } from 'react'
import CourseBadge from '../components/CourseBadge'
import UrgencyDot from '../components/UrgencyDot'

const BS_ORIGIN = 'https://brightspace.lmu.edu'

// Fix relative Brightspace links and make all links open in new tab
function fixBodyHtml(html) {
  if (!html) return ''
  return html
    .replace(/href=["']\/d2l\//g, `href="${BS_ORIGIN}/d2l/`)
    .replace(/src=["']\/d2l\//g, `src="${BS_ORIGIN}/d2l/`)
    .replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ')
}

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
        {filtered.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">No updates found.</p>
        )}
        {filtered.map(item => {
          const isOpen = expanded === item.id
          return (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden transition-shadow hover:shadow-sm"
            >
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setExpanded(isOpen ? null : item.id)}
              >
                <UrgencyDot level={item.urgency} />
                <CourseBadge courseId={item.course} courses={courses} />
                <span className="text-xs px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                  {item.type}
                </span>
                <span className="flex-1 font-medium text-sm text-gray-900 dark:text-white">{item.title}</span>
                <span className="text-xs text-gray-400 mr-2">{formatDate(item.date)}</span>
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {isOpen && (
                <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700">
                  {item.body ? (
                    <div
                      className="mt-3 text-sm text-gray-600 dark:text-gray-300 prose prose-sm dark:prose-invert max-w-none [&_a]:text-blue-500 [&_a]:underline [&_img]:rounded [&_img]:max-w-full"
                      dangerouslySetInnerHTML={{ __html: fixBodyHtml(item.body) }}
                      onClick={e => { if (e.target.tagName === 'A') e.stopPropagation() }}
                    />
                  ) : (
                    <p className="mt-3 text-sm text-gray-400 italic">No content available.</p>
                  )}
                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 text-xs font-medium text-blue-500 hover:text-blue-600 transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View on Brightspace
                    </a>
                  )}
                </div>
              )}
            </div>
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
