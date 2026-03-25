import React, { useState, useEffect, useRef } from 'react'
import { Play, Pause, RotateCcw, Clock, Flame, BookOpen } from 'lucide-react'
import { getCourseInfo } from '../hooks/useData'
import CourseBadge from '../components/CourseBadge'

const API = `http://${window.location.hostname}:3001/api`

const PRESETS = [
  { label: '25 min', seconds: 25 * 60 },
  { label: '45 min', seconds: 45 * 60 },
  { label: '60 min', seconds: 60 * 60 },
]

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function StudyTimer({ studySessions, courses, setStudySessions }) {
  const [selectedCourse, setSelectedCourse] = useState('')
  const [duration, setDuration] = useState(25 * 60)
  const [timeLeft, setTimeLeft] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const [completed, setCompleted] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (running && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current)
            setRunning(false)
            setCompleted(true)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  useEffect(() => {
    if (completed && selectedCourse) {
      fetch(`${API}/study-sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course: selectedCourse, duration }),
      })
        .then(r => r.json())
        .then(updated => setStudySessions(updated))
      setCompleted(false)
    }
  }, [completed])

  function handleStart() {
    if (timeLeft > 0) setRunning(true)
  }
  function handlePause() {
    setRunning(false)
  }
  function handleReset() {
    setRunning(false)
    setTimeLeft(duration)
    setCompleted(false)
    clearInterval(intervalRef.current)
  }
  function selectPreset(seconds) {
    setRunning(false)
    setDuration(seconds)
    setTimeLeft(seconds)
    setCompleted(false)
    clearInterval(intervalRef.current)
  }

  if (!courses) return null

  const sessions = studySessions || {}
  const todaySessions = sessions.sessions
    ? sessions.sessions.filter(s => {
        const sessionDate = new Date(s.date || s.completedAt).toDateString()
        return sessionDate === new Date().toDateString()
      })
    : []

  const todayByCourse = {}
  todaySessions.forEach(s => {
    todayByCourse[s.course] = (todayByCourse[s.course] || 0) + (s.duration || 0)
  })

  const currentStreak = sessions.currentStreak || 0
  const bestStreak = sessions.bestStreak || 0
  const progress = duration > 0 ? ((duration - timeLeft) / duration) * 100 : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Study Timer</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Focus with the Pomodoro technique</p>
      </div>

      {/* Streaks */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
          <Flame size={24} className="mx-auto text-orange-500 mb-1" />
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{currentStreak}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Current Streak</p>
        </div>
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center">
          <Flame size={24} className="mx-auto text-yellow-500 mb-1" />
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{bestStreak}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Best Streak</p>
        </div>
      </div>

      {/* Timer Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
        {/* Course selector */}
        <div className="mb-6">
          <select
            value={selectedCourse}
            onChange={e => setSelectedCourse(e.target.value)}
            disabled={running}
            className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 text-center"
          >
            <option value="">Select course to study...</option>
            {courses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Presets */}
        <div className="flex justify-center gap-3 mb-8">
          {PRESETS.map(p => (
            <button
              key={p.seconds}
              onClick={() => selectPreset(p.seconds)}
              disabled={running}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                duration === p.seconds
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              } disabled:opacity-50`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Progress ring */}
        <div className="relative inline-block mb-6">
          <svg className="w-64 h-64 transform -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" fill="none" stroke="currentColor" strokeWidth="6" className="text-gray-200 dark:text-gray-700" />
            <circle
              cx="60" cy="60" r="54" fill="none" strokeWidth="6"
              stroke={timeLeft === 0 ? '#22c55e' : '#3b82f6'}
              strokeDasharray={`${2 * Math.PI * 54}`}
              strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl font-mono font-bold text-gray-900 dark:text-white tracking-wider">
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4">
          {!running ? (
            <button
              onClick={handleStart}
              disabled={timeLeft === 0}
              className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={20} /> Start
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="flex items-center gap-2 px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
            >
              <Pause size={20} /> Pause
            </button>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-6 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
          >
            <RotateCcw size={20} /> Reset
          </button>
        </div>

        {timeLeft === 0 && (
          <p className="mt-4 text-green-600 dark:text-green-400 font-semibold">Session complete! Great work.</p>
        )}
      </div>

      {/* Today's Study Time */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
          <BookOpen size={18} /> Today's Study Time
        </h3>
        {Object.keys(todayByCourse).length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">No study sessions today yet. Start a timer above!</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(todayByCourse).map(([courseId, totalSec]) => {
              const courseInfo = getCourseInfo(courses, courseId)
              const mins = Math.round(totalSec / 60)
              return (
                <div key={courseId} className="flex items-center gap-3">
                  <CourseBadge courseId={courseId} courses={courses} />
                  <div className="flex-1">
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${Math.min((mins / 120) * 100, 100)}%`, backgroundColor: courseInfo.color }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-16 text-right">{mins} min</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
