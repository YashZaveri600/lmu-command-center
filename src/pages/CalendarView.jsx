import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, X, Download } from 'lucide-react'
import { getCourseInfo } from '../hooks/useData'
import CourseBadge from '../components/CourseBadge'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getCalendarDays(year, month) {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const days = []

  // Fill in leading blanks
  for (let i = 0; i < firstDay.getDay(); i++) {
    days.push(null)
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d))
  }
  return days
}

function generateICS(todos, updates, courses) {
  const events = []

  // Add todos with due dates
  ;(todos || []).filter(t => t.due && !t.done).forEach(t => {
    const courseName = courses?.find(c => c.id === t.course)?.name || t.course
    const date = t.due.replace(/-/g, '')
    events.push(
      `BEGIN:VEVENT\nDTSTART;VALUE=DATE:${date}\nDTEND;VALUE=DATE:${date}\nSUMMARY:${t.task}\nDESCRIPTION:${courseName} — ${t.priority} priority\nEND:VEVENT`
    )
  })

  // Add assignment updates with dates
  ;(updates || []).filter(u => u.date && u.type === 'assignment').forEach(u => {
    const date = u.date.replace(/-/g, '')
    events.push(
      `BEGIN:VEVENT\nDTSTART;VALUE=DATE:${date}\nDTEND;VALUE=DATE:${date}\nSUMMARY:${u.title}\nDESCRIPTION:${u.course}\nEND:VEVENT`
    )
  })

  return `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//EduSync//EN\nCALSCALE:GREGORIAN\n${events.join('\n')}\nEND:VCALENDAR`
}

function downloadICS(todos, updates, courses) {
  const ics = generateICS(todos, updates, courses)
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'edusync-calendar.ics'
  a.click()
  URL.revokeObjectURL(url)
}

export default function CalendarView({ updates, todos, courses, semester, calendarEvents }) {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState(null)

  if (!courses) return null

  const assignments = (updates || []).filter(u => u.type === 'assignment' || u.date)

  // Build a map of date -> items (assignments + Brightspace calendar events + pending todos)
  const dateAssignments = {}
  assignments.forEach(a => {
    const d = a.date || a.dueDate
    if (d) {
      if (!dateAssignments[d]) dateAssignments[d] = []
      dateAssignments[d].push(a)
    }
  })
  // Include pending todos with due dates
  ;(todos || []).filter(t => t.due && !t.done).forEach(t => {
    if (!dateAssignments[t.due]) dateAssignments[t.due] = []
    dateAssignments[t.due].push({
      id: `todo-${t.id}`,
      course: t.course,
      title: t.task,
      urgency: t.priority === 'high' ? 'urgent' : null,
      kind: 'todo',
    })
  })
  // Include Brightspace calendar events
  ;(calendarEvents || []).forEach(ev => {
    if (!ev.startDate) return
    const d = ev.startDate.split('T')[0]
    if (!dateAssignments[d]) dateAssignments[d] = []
    dateAssignments[d].push({
      id: `event-${ev.id}`,
      course: ev.course,
      title: ev.title,
      description: ev.description,
      location: ev.location,
      kind: 'event',
    })
  })

  // Build holiday map
  const holidays = {}
  if (semester && semester.holidays) {
    semester.holidays.forEach(h => {
      if (h.date) {
        holidays[h.date] = h.name || h.label || 'Holiday'
      }
      // Handle date ranges
      if (h.startDate && h.endDate) {
        const start = new Date(h.startDate + 'T00:00:00')
        const end = new Date(h.endDate + 'T00:00:00')
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          holidays[dateKey(d)] = h.name || h.label || 'Holiday'
        }
      }
    })
  }

  const calendarDays = getCalendarDays(viewYear, viewMonth)
  const todayStr = dateKey(today)
  const selectedDateStr = selectedDate ? dateKey(selectedDate) : null
  const selectedItems = selectedDateStr ? (dateAssignments[selectedDateStr] || []) : []
  const selectedHoliday = selectedDateStr ? holidays[selectedDateStr] : null

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
    setSelectedDate(null)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
    setSelectedDate(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Calendar</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Deadlines and important dates</p>
        </div>
        <button
          onClick={() => downloadICS(todos, updates, courses)}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          <Download size={16} /> Export to Calendar
        </button>
      </div>

      {/* Month nav */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400">
            <ChevronLeft size={20} />
          </button>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h3>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
          {calendarDays.map((day, i) => {
            if (!day) {
              return <div key={`blank-${i}`} className="bg-gray-50 dark:bg-gray-800/50 min-h-[80px]" />
            }
            const dk = dateKey(day)
            const isToday = dk === todayStr
            const isSelected = dk === selectedDateStr
            const dayItems = dateAssignments[dk] || []
            const holiday = holidays[dk]

            return (
              <button
                key={dk}
                onClick={() => setSelectedDate(day)}
                className={`bg-white dark:bg-gray-800 min-h-[80px] p-1.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors relative ${
                  isSelected ? 'ring-2 ring-blue-500 ring-inset' : ''
                }`}
              >
                <span className={`text-sm font-medium inline-block w-7 h-7 leading-7 text-center rounded-full ${
                  isToday
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300'
                }`}>
                  {day.getDate()}
                </span>

                {holiday && (
                  <div className="text-[10px] text-green-600 dark:text-green-400 font-medium truncate mt-0.5 px-0.5">
                    {holiday}
                  </div>
                )}

                {/* Assignment dots */}
                {dayItems.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1 px-0.5">
                    {dayItems.slice(0, 4).map((item, idx) => {
                      const courseInfo = getCourseInfo(courses, item.course)
                      return (
                        <span
                          key={idx}
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: courseInfo.color }}
                          title={item.title}
                        />
                      )
                    })}
                    {dayItems.length > 4 && (
                      <span className="text-[9px] text-gray-400">+{dayItems.length - 4}</span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day details */}
      {selectedDate && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </h3>
            <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={18} />
            </button>
          </div>

          {selectedHoliday && (
            <div className="mb-3 px-3 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300 font-medium">
              {selectedHoliday}
            </div>
          )}

          {selectedItems.length === 0 && !selectedHoliday && (
            <p className="text-sm text-gray-400 dark:text-gray-500">Nothing scheduled for this day.</p>
          )}

          <div className="space-y-2">
            {selectedItems.map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                <CourseBadge courseId={item.course} courses={courses} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-700 dark:text-gray-300">{item.title}</span>
                    {item.kind === 'event' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 font-medium">
                        Event
                      </span>
                    )}
                    {item.kind === 'todo' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 font-medium">
                        Task
                      </span>
                    )}
                  </div>
                  {item.location && (
                    <p className="text-xs text-gray-400 mt-0.5">{item.location}</p>
                  )}
                </div>
                {item.urgency && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    item.urgency === 'urgent' ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' :
                    item.urgency === 'soon' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400' :
                    'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                  }`}>
                    {item.urgency}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {courses.map(c => (
          <div key={c.id} className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
            {c.name}
          </div>
        ))}
      </div>
    </div>
  )
}
