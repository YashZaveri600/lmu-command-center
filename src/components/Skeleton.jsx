import React from 'react'

// Base shimmer block. Use for text lines, card bodies, avatars, etc.
// Pass explicit width/height via className.
export function Skel({ className = '' }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700/60 rounded ${className}`}
    />
  )
}

// Common composed patterns used across pages

export function SkelLine({ width = 'w-full', className = '' }) {
  return <Skel className={`h-4 ${width} ${className}`} />
}

export function SkelTitle({ className = '' }) {
  return <Skel className={`h-7 w-48 ${className}`} />
}

export function SkelSubtitle({ className = '' }) {
  return <Skel className={`h-3 w-64 ${className}`} />
}

export function SkelCard({ className = '', lines = 3 }) {
  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <Skel className="h-6 w-6 rounded-full" />
        <Skel className="h-4 w-1/2" />
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <Skel key={i} className={`h-3 ${i % 2 === 0 ? 'w-full' : 'w-3/4'}`} />
      ))}
    </div>
  )
}

export function SkelRow() {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 flex items-center gap-3">
      <Skel className="h-4 w-4 rounded" />
      <Skel className="h-5 w-16 rounded" />
      <Skel className="h-4 flex-1" />
      <Skel className="h-4 w-16" />
    </div>
  )
}

// Full page skeleton — title + subtitle + N cards or rows
export function SkelPage({ title = true, rows = 6, kind = 'row' }) {
  return (
    <div className="space-y-6">
      {title && (
        <div className="space-y-2">
          <SkelTitle />
          <SkelSubtitle />
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) =>
          kind === 'card'
            ? <SkelCard key={i} />
            : <SkelRow key={i} />
        )}
      </div>
    </div>
  )
}

// Stat-tiles skeleton (for Dashboard top row)
export function SkelStatGrid({ count = 4 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Skel className="h-5 w-5 rounded" />
            <div className="flex-1 space-y-2">
              <Skel className="h-6 w-10" />
              <Skel className="h-3 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
