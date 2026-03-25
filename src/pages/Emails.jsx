import React, { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import CourseBadge from '../components/CourseBadge'

export default function Emails({ emails, courses }) {
  const [expanded, setExpanded] = useState(null)

  if (!emails || !courses) return null

  const sorted = [...emails].sort((a, b) => {
    if (a.important !== b.important) return a.important ? -1 : 1
    return new Date(b.date) - new Date(a.date)
  })

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Professor Emails</h2>

      <div className="space-y-3">
        {sorted.map(email => (
          <div
            key={email.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 cursor-pointer hover:shadow-sm transition-shadow"
            onClick={() => setExpanded(expanded === email.id ? null : email.id)}
          >
            <div className="flex items-center gap-3">
              {email.important && <AlertCircle size={16} className="text-red-500 shrink-0" />}
              <CourseBadge courseId={email.course} courses={courses} />
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
    </div>
  )
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
