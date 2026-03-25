import React from 'react'

const colors = {
  urgent: 'bg-red-500',
  upcoming: 'bg-yellow-400',
  info: 'bg-blue-400',
}

const labels = {
  urgent: 'Urgent',
  upcoming: 'Upcoming',
  info: 'Info',
}

export default function UrgencyDot({ level, showLabel = false }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${colors[level] || 'bg-gray-400'}`} />
      {showLabel && <span className="text-xs text-gray-500 dark:text-gray-400">{labels[level]}</span>}
    </span>
  )
}
