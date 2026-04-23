import React from 'react'
import { getCourseInfo } from '../hooks/useData'
import { SkelPage } from '../components/Skeleton'

const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const dayFullNames = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday' }

export default function Schedule({ schedule, courses, updates }) {
  if (!schedule || !courses) return <SkelPage rows={5} kind="card" />


  const today = new Date()
  const todayDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][today.getDay()]

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Class Schedule</h2>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {dayNames.map(day => {
          const classes = schedule.days[day] || []
          const isToday = day === todayDay
          return (
            <div
              key={day}
              className={`bg-white dark:bg-gray-800 border rounded-lg p-4 ${
                isToday
                  ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/30'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <h3 className={`text-sm font-semibold mb-3 ${
                isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {dayFullNames[day]}
                {isToday && <span className="ml-2 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded">Today</span>}
              </h3>

              {classes.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-gray-500 italic">No classes</p>
              ) : (
                <div className="space-y-3">
                  {classes.map((cls, i) => {
                    const course = getCourseInfo(courses, cls.course)
                    return (
                      <div key={i} className="rounded-lg p-3" style={{ backgroundColor: course.color + '15' }}>
                        <div className="w-full h-1 rounded-full mb-2" style={{ backgroundColor: course.color }} />
                        <p className="text-xs font-bold" style={{ color: course.color }}>{course.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{cls.time} - {cls.endTime}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{cls.location}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
