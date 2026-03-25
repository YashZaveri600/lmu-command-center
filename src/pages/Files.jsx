import React, { useState } from 'react'
import { ChevronRight, ChevronDown, Folder, FileText, RefreshCw } from 'lucide-react'
import { getCourseInfo, syncFiles } from '../hooks/useData'

export default function Files({ courses, setCourses }) {
  const [syncing, setSyncing] = useState(false)

  if (!courses) return null

  const handleSync = async () => {
    setSyncing(true)
    try {
      await syncFiles()
      // SSE will push updated courses
    } catch {}
    setSyncing(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Course Files</h2>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Sync Files'}
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Files from ~/Desktop/LMU Spring 2026/
      </p>

      <div className="space-y-3">
        {courses.map(course => (
          <CourseFolder key={course.id} course={course} />
        ))}
      </div>
    </div>
  )
}

function CourseFolder({ course }) {
  const [open, setOpen] = useState(false)
  const folders = course.folders || []
  const totalFiles = folders.reduce((sum, f) => sum + (f.files ? f.files.length : 0), 0)

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        {open ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: course.color }} />
        <span className="font-medium text-sm text-gray-900 dark:text-white flex-1 text-left">{course.name}</span>
        <span className="text-xs text-gray-400">{totalFiles} files</span>
      </button>

      {open && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-4 pb-3">
          {folders.length === 0 ? (
            <p className="text-sm text-gray-400 py-3 italic">No files synced yet. Click Sync Files above.</p>
          ) : (
            folders.map((folder, i) => (
              <SubFolder key={i} folder={folder} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function SubFolder({ folder }) {
  const [open, setOpen] = useState(false)
  const files = folder.files || []

  return (
    <div className="ml-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white w-full"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <Folder size={14} className="text-yellow-500" />
        <span>{folder.name}</span>
        <span className="text-xs text-gray-400 ml-1">({files.length})</span>
      </button>
      {open && (
        <div className="ml-7 space-y-1 pb-1">
          {files.map((file, i) => (
            <div key={i} className="flex items-center gap-2 py-1 text-xs text-gray-500 dark:text-gray-400">
              <FileText size={12} />
              <span>{file}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
