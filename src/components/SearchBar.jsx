import React, { useState, useRef, useEffect } from 'react'
import { Search, X } from 'lucide-react'
import { searchAll, getCourseInfo } from '../hooks/useData'
import CourseBadge from './CourseBadge'

export default function SearchBar({ courses, onNavigate }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState(null)
  const [open, setOpen] = useState(false)
  const ref = useRef()

  useEffect(() => {
    if (!query.trim()) { setResults(null); return }
    const timeout = setTimeout(async () => {
      const r = await searchAll(query)
      setResults(r)
      setOpen(true)
    }, 300)
    return () => clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const totalResults = results
    ? results.updates.length + results.todos.length + results.emails.length
    : 0

  return (
    <div className="relative mb-6" ref={ref}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results && setOpen(true)}
          placeholder="Search updates, tasks, emails..."
          className="w-full pl-9 pr-9 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-900 dark:text-white placeholder-gray-400"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults(null); setOpen(false) }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        )}
      </div>

      {open && results && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {totalResults === 0 ? (
            <p className="p-4 text-sm text-gray-400">No results for "{query}"</p>
          ) : (
            <>
              {results.updates.length > 0 && (
                <ResultSection title="Updates" items={results.updates} courses={courses} renderItem={u => u.title} onNavigate={onNavigate} page="updates" />
              )}
              {results.todos.length > 0 && (
                <ResultSection title="Tasks" items={results.todos} courses={courses} renderItem={t => t.task} onNavigate={onNavigate} page="todos" />
              )}
              {results.emails.length > 0 && (
                <ResultSection title="Emails" items={results.emails} courses={courses} renderItem={e => e.subject} onNavigate={onNavigate} page="emails" />
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ResultSection({ title, items, courses, renderItem, onNavigate, page }) {
  return (
    <div className="border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <p className="px-3 py-1.5 text-xs font-semibold text-gray-400 uppercase">{title}</p>
      {items.slice(0, 5).map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(page)}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <CourseBadge courseId={item.course} courses={courses} />
          <span className="truncate">{renderItem(item)}</span>
        </button>
      ))}
    </div>
  )
}
