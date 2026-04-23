import React, { useState } from 'react'
import { Plus, Trash2, TrendingUp, Award } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { getCourseInfo } from '../hooks/useData'
import CourseBadge from '../components/CourseBadge'
import WhatIfCalculator from '../components/WhatIfCalculator'
import { SkelPage } from '../components/Skeleton'
import ConfirmDialog from '../components/ConfirmDialog'
import { useToast } from '../components/Toast'

const API = import.meta.env.DEV
  ? `http://${window.location.hostname}:3001/api`
  : '/api'

const COURSE_COLORS = {
  managing: '#8B1A1A',
  philosophy: '#1A3B5C',
  marketing: '#2D6A4F',
  accounting: '#7B2D8B',
}

const CHART_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4']

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
  if (pct >= 60) return 'D-'
  return 'F'
}

function gpaPoints(letter) {
  const map = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'D+': 1.3, 'D': 1.0, 'D-': 0.7, 'F': 0.0 }
  return map[letter] ?? 0.0
}

function getWeight(w) {
  if (typeof w === 'number') return w
  if (w && typeof w === 'object' && w.weight != null) return w.weight * 100
  return 0
}

function calcCoursePercentage(courseGrades, weights) {
  if (!courseGrades || courseGrades.length === 0 || !weights) return null
  const categoryScores = {}
  const categoryCounts = {}
  courseGrades.forEach(g => {
    const cat = g.category
    if (!categoryScores[cat]) { categoryScores[cat] = 0; categoryCounts[cat] = 0 }
    categoryScores[cat] += (g.score / g.maxScore) * 100
    categoryCounts[cat] += 1
  })
  let totalWeighted = 0
  let totalWeight = 0
  Object.entries(categoryScores).forEach(([cat, total]) => {
    const avg = total / categoryCounts[cat]
    const weight = getWeight(weights[cat])
    if (weight > 0) {
      totalWeighted += avg * (weight / 100)
      totalWeight += weight
    }
  })
  if (totalWeight === 0) return null
  return (totalWeighted / totalWeight) * 100
}

export default function Grades({ grades, courses, setGrades }) {
  const [showForm, setShowForm] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState('')
  const [category, setCategory] = useState('')
  const [name, setName] = useState('')
  const [score, setScore] = useState('')
  const [maxScore, setMaxScore] = useState('100')
  const [confirm, setConfirm] = useState(null)
  const toast = useToast()

  if (!grades || !courses) return <SkelPage rows={4} kind="card" />


  const courseWeights = grades.courses || {}
  const allGrades = {}
  Object.entries(courseWeights).forEach(([cId, cData]) => {
    allGrades[cId] = cData.grades || []
  })

  const coursePercentages = {}
  Object.keys(courseWeights).forEach(cId => {
    const pct = calcCoursePercentage(allGrades[cId] || [], courseWeights[cId]?.weights || {})
    coursePercentages[cId] = pct
  })

  const validPercentages = Object.values(coursePercentages).filter(p => p !== null)
  const overallGPA = validPercentages.length > 0
    ? validPercentages.reduce((sum, p) => sum + gpaPoints(letterGrade(p)), 0) / validPercentages.length
    : null

  const currentWeights = selectedCourse && courseWeights[selectedCourse]
    ? Object.keys(courseWeights[selectedCourse].weights || {})
    : []

  async function handleAdd(e) {
    e.preventDefault()
    if (!selectedCourse || !category || !score || !maxScore) return
    const res = await fetch(`${API}/grades`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId: selectedCourse, category, score: Number(score), maxScore: Number(maxScore), name: name || category }),
    })
    const updated = await res.json()
    setGrades(updated)
    setShowForm(false)
    setSelectedCourse('')
    setCategory('')
    setName('')
    setScore('')
    setMaxScore('100')
  }

  function handleDelete(courseId, gradeId) {
    // Look up grade name for the confirm dialog
    const gradeList = (grades.courses?.[courseId]?.grades) || []
    const g = gradeList.find(x => x.id === gradeId)
    const name = g?.name || 'this grade'
    setConfirm({
      title: 'Delete grade?',
      message: `"${name}" will be removed from your grade tracker. This only removes it locally — your Brightspace grade is unaffected.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        await fetch(`${API}/grades/${courseId}/${gradeId}`, { method: 'DELETE' })
        const res = await fetch(`${API}/grades`)
        const updated = await res.json()
        setGrades(updated)
        toast.show('Grade deleted', 'success')
      },
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Grade Tracker</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track grades and calculate GPA</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} /> Add Grade
        </button>
      </div>

      {/* Overall GPA */}
      {overallGPA !== null && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Award size={24} className="text-yellow-500" />
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Overall GPA</span>
          </div>
          <p className="text-5xl font-bold text-gray-900 dark:text-white">{overallGPA.toFixed(2)}</p>
        </div>
      )}

      {/* Grade Trend Chart */}
      {Object.keys(allGrades).some(cId => (allGrades[cId] || []).length > 1) && (() => {
        // Build unified timeline: collect all dates, compute running avg per course at each date
        const courseIds = Object.keys(allGrades).filter(cId => (allGrades[cId] || []).length > 1)
        const allDates = new Set()
        const courseData = {}

        courseIds.forEach(cId => {
          const sorted = [...(allGrades[cId] || [])].sort((a, b) => (a.date || '').localeCompare(b.date || ''))
          const weights = courseWeights[cId]?.weights || {}
          courseData[cId] = {}
          // At each grade entry, compute the weighted course percentage using all grades up to that point
          sorted.forEach((g, i) => {
            const date = g.date || `1970-01-${String(i + 1).padStart(2, '0')}`
            allDates.add(date)
            const gradesUpToNow = sorted.slice(0, i + 1)
            const pct = calcCoursePercentage(gradesUpToNow, weights)
            courseData[cId][date] = pct !== null ? Number(pct.toFixed(1)) : null
          })
        })

        // Sort dates chronologically and build chart data
        const sortedDates = [...allDates].sort()
        const chartData = sortedDates.map(date => {
          const point = { date: new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) }
          courseIds.forEach(cId => {
            // Carry forward the last known value
            point[cId] = courseData[cId][date] || null
          })
          return point
        })

        // Fill forward: if a course has no value on a date, use its last known value
        courseIds.forEach(cId => {
          let last = null
          chartData.forEach(point => {
            if (point[cId] !== null) last = point[cId]
            else if (last !== null) point[cId] = last
          })
        })

        return (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={18} className="text-blue-500" />
              <h3 className="font-semibold text-gray-900 dark:text-white">Grade Trends</h3>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9CA3AF" />
                <YAxis domain={[50, 100]} tick={{ fontSize: 11 }} stroke="#9CA3AF" unit="%" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2937', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                  formatter={(value) => [`${value.toFixed(1)}%`]}
                />
                <Legend />
                {courseIds.map((cId, idx) => (
                  <Line
                    key={cId}
                    dataKey={cId}
                    name={getCourseInfo(courses, cId).name || cId}
                    stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      })()}

      {/* What-If Calculator */}
      <WhatIfCalculator grades={grades} courses={courses} />

      {/* Add Grade Form */}
      {showForm && (
        <form onSubmit={handleAdd} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-white">Add New Grade</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course</label>
              <select
                value={selectedCourse}
                onChange={e => { setSelectedCourse(e.target.value); setCategory('') }}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
              >
                <option value="">Select course...</option>
                {Object.keys(courseWeights).map(cId => (
                  <option key={cId} value={cId}>{getCourseInfo(courses, cId).name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                disabled={!selectedCourse}
              >
                <option value="">Select category...</option>
                {currentWeights.map(w => (
                  <option key={w} value={w}>{w} — {getWeight(courseWeights[selectedCourse].weights[w]).toFixed(0)}% of grade</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assignment Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Midterm Exam"
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Score</label>
                <input
                  type="number"
                  value={score}
                  onChange={e => setScore(e.target.value)}
                  placeholder="85"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Max Score</label>
                <input
                  type="number"
                  value={maxScore}
                  onChange={e => setMaxScore(e.target.value)}
                  placeholder="100"
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Grade</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500">Cancel</button>
          </div>
        </form>
      )}

      {/* Per-Course Grade Cards */}
      <div className="space-y-4">
        {Object.entries(courseWeights).map(([courseId, courseData]) => {
          const courseInfo = getCourseInfo(courses, courseId)
          const pct = coursePercentages[courseId]
          const letter = pct !== null ? letterGrade(pct) : '--'
          const gpa = pct !== null ? gpaPoints(letter).toFixed(1) : '--'
          const weights = courseData.weights || {}
          const courseGradeList = allGrades[courseId] || []
          const color = COURSE_COLORS[courseId] || courseInfo.color

          return (
            <div key={courseId} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <CourseBadge courseId={courseId} courses={courses} />
                  <h3 className="font-semibold text-gray-900 dark:text-white">{courseInfo.name}</h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">{letter}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">({pct !== null ? pct.toFixed(1) + '%' : 'No grades'} / {gpa} GPA)</span>
                </div>
              </div>

              {/* Grade bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4">
                <div
                  className="h-3 rounded-full transition-all duration-500"
                  style={{ width: pct !== null ? `${Math.min(pct, 100)}%` : '0%', backgroundColor: color }}
                />
              </div>

              {/* Weights breakdown */}
              <div className="space-y-1 mb-3">
                {Object.entries(weights).map(([cat, weight]) => (
                  <div key={cat} className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{cat} — {getWeight(weight).toFixed(0)}% of grade</span>
                    <span>
                      {courseGradeList.filter(g => g.category === cat).length} grade(s)
                    </span>
                  </div>
                ))}
              </div>

              {/* Individual grades */}
              {courseGradeList.length > 0 && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-2">
                  {courseGradeList.map(g => (
                    <div key={g.id} className="flex items-center justify-between text-sm p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="flex items-center gap-3">
                        <span className="text-gray-900 dark:text-white font-medium">{g.name}</span>
                        <span className="text-xs text-gray-400 dark:text-gray-500">{g.category}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-gray-700 dark:text-gray-300">
                          {g.score}/{g.maxScore}
                          <span className="text-gray-400 ml-1">({((g.score / g.maxScore) * 100).toFixed(0)}%)</span>
                        </span>
                        <button
                          onClick={() => handleDelete(courseId, g.id)}
                          className="text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ConfirmDialog data={confirm} onDismiss={() => setConfirm(null)} />
    </div>
  )
}
