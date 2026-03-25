import React from 'react'

export default function SearchResults({ courses }) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Search</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Use the search bar above to find updates, tasks, and emails.
      </p>
    </div>
  )
}
