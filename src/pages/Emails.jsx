import React, { useState } from 'react'
import { AlertCircle, Mail, Clock, Sparkles, Lock } from 'lucide-react'
import CourseBadge from '../components/CourseBadge'
import { SkelPage } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

export default function Emails({ emails, courses, emailEnabled }) {
  const [expanded, setExpanded] = useState(null)
  const [filterCourse, setFilterCourse] = useState('all')

  if (!emails || !courses) return <SkelPage rows={6} />

  // If the user hasn't granted Microsoft email access yet, show a clean
  // "Coming Soon" card — no functional button, pure informational.
  if (!emailEnabled) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Professor Emails</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Unified inbox for professor messages from .edu senders</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-900/20 dark:via-blue-900/20 dark:to-indigo-900/20 border border-purple-200 dark:border-purple-800 rounded-xl p-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-blue-600 shadow-lg shadow-purple-500/30 mb-4">
            <Mail size={26} className="text-white" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 text-purple-700 dark:text-purple-300 text-[10px] font-semibold uppercase tracking-wide mb-3">
            <Sparkles size={11} /> Coming Soon
          </div>

          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1.5">Professor Emails is almost here</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto mb-4">
            Once live, EduSync will automatically pull professor emails from your Microsoft inbox, filter to .edu senders, and match each message to the right course — all in one clean feed.
          </p>

          <div className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 bg-white/60 dark:bg-gray-800/60 rounded-full px-3 py-1.5 border border-gray-200 dark:border-gray-700">
            <Lock size={11} /> Awaiting LMU IT approval
          </div>
        </div>

        {/* Feature preview — shows what's coming */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 opacity-70">
          <PreviewCard title="Filtered to .edu" description="Only messages from professors, not your whole inbox" />
          <PreviewCard title="Auto-matched to courses" description="Subject + sender mapped to the right class" />
          <PreviewCard title="Important emails flagged" description="Deadlines and grade notices pop to the top" />
        </div>
      </div>
    )
  }


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

function PreviewCard({ title, description }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        <Clock size={12} className="text-gray-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Preview</span>
      </div>
      <p className="text-sm font-medium text-gray-900 dark:text-white">{title}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
    </div>
  )
}
