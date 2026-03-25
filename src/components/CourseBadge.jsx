import React from 'react'
import { getCourseInfo } from '../hooks/useData'

export default function CourseBadge({ courseId, courses, className = '' }) {
  const course = getCourseInfo(courses, courseId)
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded text-xs font-semibold text-white ${className}`}
      style={{ backgroundColor: course.color }}
    >
      {course.shortCode}
    </span>
  )
}
