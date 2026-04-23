import React from 'react'

// Empty state placeholder — use when a page has loaded but has no data.
// Keep it short, neutral, and actionable when possible.
export default function EmptyState({ icon, title, message, action }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
      {icon && (
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 mb-3">
          {icon}
        </div>
      )}
      {title && <p className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">{title}</p>}
      {message && <p className="text-xs text-gray-500 dark:text-gray-400">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
