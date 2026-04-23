import React, { useMemo, useState } from 'react'
import {
  ArrowLeft, Award, Bell, CheckSquare, FolderOpen, Mail, CalendarDays, Star,
  ExternalLink, Download, ChevronDown, ChevronRight, MessageSquare, ClipboardList,
} from 'lucide-react'
import { SkelPage } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'

// Inline letter grade + GPA helpers (match the logic used elsewhere in the app)
function letterGrade(pct) {
  if (pct >= 93) return 'A'
  if (pct >= 90) return 'A-'
  if (pct >= 87) return 'B+'
  if (pct >= 83) return 'B'
  if (pct >= 80) return 'B-'
  if (pct >= 77) return 'C+'
  if (pct >= 73) return 'C'
  if (pct >= 70) return 'C-'
  if (pct >= 67) return 'D+'
  if (pct >= 63) return 'D'
  return 'F'
}

function getWeight(w) {
  if (typeof w === 'number') return w
  if (w && typeof w === 'object' && w.weight != null) return w.weight * 100
  return 0
}

function calcCoursePct(grades, weights) {
  if (!grades || grades.length === 0) return null
  const catSum = {}, catCount = {}
  grades.forEach(g => {
    if (!catSum[g.category]) { catSum[g.category] = 0; catCount[g.category] = 0 }
    catSum[g.category] += (g.score / g.maxScore) * 100
    catCount[g.category] += 1
  })
  let totalWeighted = 0, totalWeight = 0
  Object.entries(catSum).forEach(([cat, sum]) => {
    const avg = sum / catCount[cat]
    const w = getWeight(weights[cat])
    if (w > 0) { totalWeighted += avg * w; totalWeight += w }
  })
  return totalWeight > 0 ? totalWeighted / totalWeight : null
}

function findSyllabus(items) {
  if (!items || items.length === 0) return null
  const leaf = items.find(c => /syllabus/i.test(c.title) && ['file', 'page', 'link', 'pdf', 'pptx', 'docx'].includes(c.type))
  return leaf || items.find(c => /syllabus/i.test(c.title)) || null
}

function stripLinks(html) {
  if (!html) return ''
  return html.replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''))
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function CourseDetail({
  courseId, courses, updates, todos, grades, courseContent, calendarEvents, emails,
  onNavigate,
}) {
  const [expandedAnnouncement, setExpandedAnnouncement] = useState(null)
  const [expandedFeedback, setExpandedFeedback] = useState(null)

  // Loading skeleton while core data isn't in yet
  if (!courses || !updates || !todos || !grades) {
    return <SkelPage rows={5} kind="card" />
  }

  const course = courses.find(c => c.id === courseId)
  if (!course) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => onNavigate('dashboard')}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft size={14} /> Back
        </button>
        <EmptyState
          icon={<FolderOpen size={22} />}
          title="Course not found"
          message="That course isn't in your current semester. Try resyncing from Settings."
        />
      </div>
    )
  }

  // Filter everything to this course
  const courseGrades = grades?.courses?.[courseId]?.grades || []
  const weights = grades?.courses?.[courseId]?.weights || {}
  const pct = calcCoursePct(courseGrades, weights)
  const letter = pct !== null ? letterGrade(pct) : '--'

  const announcements = (updates || []).filter(u => u.course === courseId)
  const pendingTasks = (todos || []).filter(t => t.course === courseId && !t.done).sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return (order[a.priority] ?? 3) - (order[b.priority] ?? 3)
  })
  const contentItems = (courseContent || []).filter(c => c.course === courseId)
  const events = (calendarEvents || []).filter(e => e.course === courseId)
  const courseEmails = (emails || []).filter(e => e.course === courseId)
  const syllabus = findSyllabus(contentItems)

  // Category breakdown
  const categories = Object.entries(weights).map(([cat, w]) => {
    const items = courseGrades.filter(g => g.category === cat)
    const avg = items.length > 0
      ? items.reduce((s, g) => s + (g.score / g.maxScore) * 100, 0) / items.length
      : null
    return {
      name: cat,
      weight: getWeight(w),
      avg,
      count: items.length,
    }
  }).sort((a, b) => (b.weight || 0) - (a.weight || 0))

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <button
        onClick={() => onNavigate('dashboard')}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <ArrowLeft size={14} /> Back to dashboard
      </button>

      {/* Header */}
      <div
        className="rounded-xl p-6 border border-gray-200 dark:border-gray-700 relative overflow-hidden"
        style={{ backgroundColor: 'var(--course-bg, white)' }}
      >
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5"
          style={{ backgroundColor: course.color }}
        />
        <div className="pl-3">
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{course.shortCode}</p>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-0.5">{course.name}</h2>
              {course.professor && <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{course.professor}</p>}
            </div>
            <div className="flex items-center gap-2">
              {pct !== null && (
                <div className="text-right">
                  <p className="text-3xl font-bold text-gray-900 dark:text-white leading-none">{letter}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{pct.toFixed(1)}%</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Syllabus quick-access */}
      {syllabus && (
        <a
          href={syllabus.url || undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 px-4 py-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/30 cursor-pointer transition-colors group"
        >
          <Star size={16} className="text-indigo-500 fill-indigo-500 flex-shrink-0" />
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 flex-shrink-0">
            Syllabus
          </span>
          <span className="text-sm font-medium text-gray-900 dark:text-white flex-1 truncate">{syllabus.title}</span>
          <ExternalLink size={14} className="text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-200 flex-shrink-0" />
        </a>
      )}

      {/* Two-column layout: Grade breakdown + Pending tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Grade breakdown */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <Award size={16} className="text-yellow-500" /> Grade breakdown
          </h3>
          {categories.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">No grade categories set up.</p>
          ) : (
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.name} className="flex items-center justify-between text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{cat.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{cat.count} grade{cat.count === 1 ? '' : 's'} · weighted {cat.weight.toFixed(0)}%</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className="font-mono text-gray-900 dark:text-white">
                      {cat.avg !== null ? `${cat.avg.toFixed(0)}%` : '—'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending tasks */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <CheckSquare size={16} className="text-blue-500" /> Pending tasks
          </h3>
          {pendingTasks.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Nothing pending. Nice.</p>
          ) : (
            <div className="space-y-2">
              {pendingTasks.slice(0, 8).map(t => {
                const overdue = t.due && new Date(t.due + 'T23:59:59') < new Date()
                return (
                  <div key={t.id} className="flex items-center gap-2 text-sm p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      t.priority === 'high' ? 'bg-red-500' : t.priority === 'medium' ? 'bg-yellow-400' : 'bg-blue-400'
                    }`} />
                    <span className={`flex-1 truncate ${overdue ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-700 dark:text-gray-200'}`}>
                      {t.task}
                    </span>
                    {t.due && (
                      <span className={`text-xs flex-shrink-0 ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
                        {overdue ? 'OVERDUE' : formatDate(t.due)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Individual grades */}
      {courseGrades.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">All grades ({courseGrades.length})</h3>
          <div className="space-y-1">
            {courseGrades.map(g => {
              const hasFeedback = Boolean(g.feedback && g.feedback.trim())
              const isOpen = expandedFeedback === g.id
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between text-sm p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-gray-900 dark:text-white font-medium truncate">{g.name}</span>
                      <span className="text-xs text-gray-400 flex-shrink-0">{g.category}</span>
                      {hasFeedback && (
                        <button
                          onClick={() => setExpandedFeedback(isOpen ? null : g.id)}
                          className="flex items-center gap-1 text-[10px] font-semibold tracking-wide px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex-shrink-0"
                        >
                          <MessageSquare size={10} /> FEEDBACK {isOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                        </button>
                      )}
                    </div>
                    <span className="font-mono text-gray-700 dark:text-gray-300 flex-shrink-0 ml-2">
                      {g.score}/{g.maxScore}
                      <span className="text-gray-400 ml-1">({((g.score / g.maxScore) * 100).toFixed(0)}%)</span>
                    </span>
                  </div>
                  {hasFeedback && isOpen && (
                    <div className="ml-2 mb-2 mt-1 bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-400 dark:border-blue-600 rounded px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-1 flex items-center gap-1">
                        <MessageSquare size={10} /> Professor feedback
                      </p>
                      <div
                        className="text-sm text-gray-700 dark:text-gray-200"
                        dangerouslySetInnerHTML={{ __html: stripLinks(g.feedback) }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent announcements */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
          <Bell size={16} className="text-purple-500" /> Announcements ({announcements.length})
        </h3>
        {announcements.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No announcements from this professor yet.</p>
        ) : (
          <div className="space-y-2">
            {announcements.slice(0, 8).map(a => {
              const isOpen = expandedAnnouncement === a.id
              return (
                <div key={a.id} className="border border-gray-100 dark:border-gray-700 rounded">
                  <button
                    onClick={() => setExpandedAnnouncement(isOpen ? null : a.id)}
                    className="w-full flex items-center gap-2 p-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left"
                  >
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      a.urgency === 'urgent' ? 'bg-red-500' : a.urgency === 'upcoming' ? 'bg-yellow-400' : 'bg-gray-300'
                    }`} />
                    <span className="text-sm font-medium text-gray-900 dark:text-white flex-1 truncate">{a.title}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(a.date)}</span>
                    {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                  </button>
                  {isOpen && a.body && (
                    <div
                      className="px-2.5 pb-2.5 text-sm text-gray-600 dark:text-gray-300"
                      dangerouslySetInnerHTML={{ __html: stripLinks(a.body) }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Course files — first 15 non-module items */}
      {contentItems.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <FolderOpen size={16} className="text-yellow-500" /> Files
            </h3>
            <button
              onClick={() => onNavigate('files')}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              Open full tree →
            </button>
          </div>
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {contentItems.filter(i => i.type !== 'module' && i.url).slice(0, 15).map(item => (
              <a
                key={item.bsId}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-200"
              >
                <span className="text-xs text-gray-400 uppercase font-mono w-10">{item.type}</span>
                <span className="flex-1 truncate">{item.title}</span>
                <ExternalLink size={12} className="text-gray-300 dark:text-gray-600 flex-shrink-0" />
              </a>
            ))}
            {contentItems.filter(i => i.type !== 'module' && i.url).length > 15 && (
              <p className="text-xs text-gray-400 pt-2 text-center">
                + {contentItems.filter(i => i.type !== 'module' && i.url).length - 15} more — open the full tree
              </p>
            )}
          </div>
        </div>
      )}

      {/* Upcoming events */}
      {events.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-3">
            <CalendarDays size={16} className="text-indigo-500" /> Upcoming events
          </h3>
          <div className="space-y-1">
            {events.slice(0, 5).map(e => (
              <div key={e.id} className="flex items-center gap-2 text-sm p-1.5">
                <span className="text-xs text-gray-400 w-20 flex-shrink-0">{formatDate(e.startDate?.split('T')[0])}</span>
                <span className="flex-1 truncate">{e.title}</span>
                {e.location && <span className="text-xs text-gray-400">{e.location}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Professor emails — recent */}
      {courseEmails.length > 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Mail size={16} className="text-blue-500" /> Recent professor emails
            </h3>
            <button
              onClick={() => onNavigate('emails')}
              className="text-xs text-blue-500 hover:text-blue-600"
            >
              See all →
            </button>
          </div>
          <div className="space-y-1">
            {courseEmails.slice(0, 5).map(e => (
              <div key={e.id} className="text-sm p-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-20 flex-shrink-0">{formatDate(e.date)}</span>
                  <span className="font-medium text-gray-900 dark:text-white flex-1 truncate">{e.subject}</span>
                </div>
                {e.preview && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1 ml-[88px]">{stripLinks(e.preview).slice(0, 120)}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
