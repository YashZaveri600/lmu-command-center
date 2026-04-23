import React, { useState } from 'react'
import { Plus, Trash2, StickyNote, Filter } from 'lucide-react'
import { getCourseInfo } from '../hooks/useData'
import CourseBadge from '../components/CourseBadge'
import { SkelPage } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

const API = `http://${window.location.hostname}:3001/api`

function relativeTime(dateStr) {
  const now = new Date()
  const date = new Date(dateStr)
  const diffMs = now - date
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)
  const diffWeek = Math.floor(diffDay / 7)

  if (diffSec < 60) return 'just now'
  if (diffMin < 60) return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`
  if (diffDay === 1) return 'yesterday'
  if (diffDay < 7) return `${diffDay} days ago`
  if (diffWeek === 1) return '1 week ago'
  return `${diffWeek} weeks ago`
}

export default function Notes({ notes, courses, setNotes }) {
  const [showForm, setShowForm] = useState(false)
  const [course, setCourse] = useState('')
  const [text, setText] = useState('')
  const [filterCourse, setFilterCourse] = useState('all')
  const [confirm, setConfirm] = useState(null)
  const toast = useToast()

  if (!notes || !courses) return <SkelPage rows={4} kind="card" />


  const sortedNotes = [...notes].sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
  const filteredNotes = filterCourse === 'all' ? sortedNotes : sortedNotes.filter(n => n.course === filterCourse)

  async function handleAdd(e) {
    e.preventDefault()
    if (!course || !text.trim()) return
    const res = await fetch(`${API}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ course, text: text.trim() }),
    })
    const updated = await res.json()
    setNotes(updated)
    setShowForm(false)
    setCourse('')
    setText('')
  }

  function handleDelete(id) {
    const note = notes.find(n => n.id === id)
    const preview = (note?.text || '').slice(0, 60) + (note?.text?.length > 60 ? '...' : '')
    setConfirm({
      title: 'Delete note?',
      message: preview ? `"${preview}" will be removed permanently.` : 'This note will be removed permanently.',
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        const res = await fetch(`${API}/notes/${id}`, { method: 'DELETE' })
        const updated = await res.json()
        setNotes(updated)
        toast.show('Note deleted', 'success')
      },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Quick Notes</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{notes.length} note{notes.length !== 1 ? 's' : ''} total</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> New Note
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter size={16} className="text-gray-400" />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterCourse('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filterCourse === 'all'
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            All
          </button>
          {courses.map(c => (
            <button
              key={c.id}
              onClick={() => setFilterCourse(c.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterCourse === c.id
                  ? 'text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
              style={filterCourse === c.id ? { backgroundColor: c.color } : {}}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Add Note Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">New Note</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course</label>
            <select
              value={course}
              onChange={e => setCourse(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
            >
              <option value="">Select course...</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Note</label>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={4}
              placeholder="Type your note here..."
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Note</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
          </div>
        </form>
      )}

      {/* Notes List */}
      <div className="space-y-3">
        {filteredNotes.length === 0 && (
          <EmptyState
            icon={<StickyNote size={22} />}
            title="No notes yet"
            message="Tap Add Note above to jot down a thought, reminder, or quick study point."
          />
        )}
        {filteredNotes.map(note => (
          <div
            key={note.id}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CourseBadge courseId={note.course} courses={courses} />
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {relativeTime(note.createdAt || note.date)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{note.text}</p>
              </div>
              <button
                onClick={() => handleDelete(note.id)}
                className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog data={confirm} onDismiss={() => setConfirm(null)} />
    </div>
  )
}
