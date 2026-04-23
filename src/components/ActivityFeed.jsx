import React, { useMemo } from 'react'
import {
  Bell, Award, CheckSquare, MessageSquare, ArrowRight, Activity as ActivityIcon,
} from 'lucide-react'
import CourseBadge from './CourseBadge'

// "What's new across all my courses" feed, synthesized from existing
// data so no new backend endpoint is required. Shows up to 20 items
// from the last 14 days, sorted newest-first.
export default function ActivityFeed({ updates, grades, todos, courses, onNavigate, limit = 10 }) {
  const items = useMemo(() => buildActivity({ updates, grades, todos, limit: 50 }), [updates, grades, todos, limit])
  const shown = items.slice(0, limit)

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <ActivityIcon size={16} className="text-blue-500" /> Recent Activity
        </h3>
        {items.length > limit && onNavigate && (
          <button
            onClick={() => onNavigate('updates')}
            className="text-xs text-blue-500 hover:text-blue-600 flex items-center gap-1"
          >
            See all <ArrowRight size={12} />
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-gray-500 py-3 text-center">
          No recent activity yet. Sync runs every 15 minutes — your Brightspace updates will show up here.
        </p>
      ) : (
        <ol className="relative space-y-3 pl-6 before:absolute before:left-[9px] before:top-1.5 before:bottom-1.5 before:w-px before:bg-gray-100 dark:before:bg-gray-700">
          {shown.map(item => <ActivityRow key={item.key} item={item} courses={courses} onNavigate={onNavigate} />)}
        </ol>
      )}
    </div>
  )
}

function ActivityRow({ item, courses, onNavigate }) {
  const style = TYPE_STYLES[item.type] || TYPE_STYLES.default
  const Icon = style.icon
  return (
    <li className="relative">
      <span className={`absolute -left-6 top-0.5 flex items-center justify-center w-[18px] h-[18px] rounded-full ${style.bg}`}>
        <Icon size={10} className={style.iconColor} />
      </span>
      <div className="flex items-start gap-2 flex-wrap">
        <CourseBadge courseId={item.course} courses={courses} />
        <button
          onClick={() => onNavigate && onNavigate(style.page)}
          className="text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white text-left flex-1"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400 dark:text-gray-500 mr-1.5">
            {style.label}
          </span>
          {item.title}
          {item.meta && <span className="text-xs text-gray-400 ml-1.5">({item.meta})</span>}
        </button>
        <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{relativeDate(item.date)}</span>
      </div>
    </li>
  )
}

// ─── helpers ───

const TYPE_STYLES = {
  announcement: {
    icon: Bell, label: 'Announcement', page: 'updates',
    bg: 'bg-purple-100 dark:bg-purple-900/30',
    iconColor: 'text-purple-600 dark:text-purple-300',
  },
  grade: {
    icon: Award, label: 'Grade posted', page: 'grades',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    iconColor: 'text-yellow-600 dark:text-yellow-300',
  },
  feedback: {
    icon: MessageSquare, label: 'Feedback', page: 'grades',
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    iconColor: 'text-blue-600 dark:text-blue-300',
  },
  task: {
    icon: CheckSquare, label: 'Task completed', page: 'todos',
    bg: 'bg-green-100 dark:bg-green-900/30',
    iconColor: 'text-green-600 dark:text-green-300',
  },
  default: {
    icon: ActivityIcon, label: 'Activity', page: 'dashboard',
    bg: 'bg-gray-100 dark:bg-gray-700',
    iconColor: 'text-gray-500',
  },
}

function buildActivity({ updates, grades, todos, limit }) {
  const out = []
  const cutoff = Date.now() - 14 * 24 * 60 * 60 * 1000

  // Announcements
  for (const u of (updates || [])) {
    const ts = u.date ? new Date(u.date).getTime() : 0
    if (!ts || ts < cutoff) continue
    out.push({
      key: `announcement-${u.id}`,
      type: 'announcement',
      course: u.course,
      title: u.title,
      date: u.date,
      sortTs: ts,
    })
  }

  // Grades + feedback
  const courseGrades = grades?.courses || {}
  for (const [courseId, cdata] of Object.entries(courseGrades)) {
    for (const g of (cdata.grades || [])) {
      const ts = g.date ? new Date(g.date).getTime() : 0
      if (!ts || ts < cutoff) continue
      const pct = g.maxScore > 0 ? Math.round((g.score / g.maxScore) * 100) : null
      out.push({
        key: `grade-${courseId}-${g.id}`,
        type: 'grade',
        course: courseId,
        title: g.name,
        meta: pct !== null ? `${g.score}/${g.maxScore} · ${pct}%` : null,
        date: g.date,
        sortTs: ts,
      })
      if (g.feedback && typeof g.feedback === 'string' && g.feedback.trim()) {
        out.push({
          key: `feedback-${courseId}-${g.id}`,
          type: 'feedback',
          course: courseId,
          title: `Prof left feedback on ${g.name}`,
          date: g.date,
          sortTs: ts + 1, // tie-break: feedback just after grade
        })
      }
    }
  }

  // Auto-completed tasks (sorted by due date as a proxy for "when done")
  for (const t of (todos || [])) {
    if (!t.done || !t.due) continue
    const ts = new Date(t.due).getTime()
    if (!ts || ts < cutoff) continue
    out.push({
      key: `task-${t.id}`,
      type: 'task',
      course: t.course,
      title: t.task,
      date: t.due,
      sortTs: ts,
    })
  }

  out.sort((a, b) => b.sortTs - a.sortTs)
  return out.slice(0, limit)
}

function relativeDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''))
  const diffMs = Date.now() - d.getTime()
  const day = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (day === 0) return 'Today'
  if (day === 1) return 'Yesterday'
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
