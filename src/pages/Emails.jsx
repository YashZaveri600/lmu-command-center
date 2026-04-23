import React, { useState } from 'react'
import { AlertCircle, Mail } from 'lucide-react'
import CourseBadge from '../components/CourseBadge'
import { SkelPage } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

export default function Emails({ emails, courses }) {
  const [expanded, setExpanded] = useState(null)
  const [filterCourse, setFilterCourse] = useState('all')

  if (!emails || !courses) return <SkelPage rows={6} />


  const filtered = filterCourse === 'all'
    ? emails
    : filterCourse === 'unmatched'
      ? emails.filter(e => !e.course)
      : emails.filter(e => e.course === filterCourse)

  const sorted = [...filtered].sort((a, b) => {
    if (a.important !== b.important) return a.important ? -1 : 1
    return new Date(b.date) - new Date(a.date)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Professor Emails</h2>
        <select
          value={filterCourse}
          onChange={e => setFilterCourse(e.target.value)}
          className="text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
        >
          <option value="all">All Emails</option>
          {courses.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          <option value="unmatched">Other / Unmatched</option>
        </select>
      </div>

      {sorted.length === 0 ? (
        emails.length === 0 ? (
          <EmptyState
            icon={<Mail size={22} />}
            title="No emails synced yet"
            message="Connect email access in Settings to pull professor emails from your Microsoft account. Only messages from .edu senders are shown."
          />
        ) : (
          <EmptyState
            icon={<Mail size={22} />}
            title="No emails match this filter"
            message="Try switching to All Emails or another course."
          />
        )
      ) : (
        <div className="space-y-3">
          {sorted.map(email => (
            <div
              key={email.id}
              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:shadow-sm transition-shadow"
              onClick={() => setExpanded(expanded === email.id ? null : email.id)}
            >
              <div className="flex items-center gap-3">
                {email.important && <AlertCircle size={16} className="text-red-500 shrink-0" />}
                {email.course ? (
                  <CourseBadge courseId={email.course} courses={courses} />
                ) : (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-semibold text-gray-500 bg-gray-100 dark:bg-gray-700 dark:text-gray-400">General</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{email.subject}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{email.from}</p>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{formatDate(email.date)}</span>
              </div>
              {expanded === email.id && (
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 pl-4 border-l-2 border-gray-200 dark:border-gray-600 leading-relaxed">
                  {email.preview}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
