import React, { useState, useMemo } from 'react'
import { Calculator, Target, TrendingDown, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react'
import { getCourseInfo } from '../hooks/useData'

const COURSE_COLORS = {
  managing: '#8B1A1A',
  philosophy: '#1A3B5C',
  marketing: '#2D6A4F',
  accounting: '#7B2D8B',
}

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

function calcPercentage(gradesList, weights) {
  if (!gradesList || gradesList.length === 0 || !weights) return null
  const categoryScores = {}
  const categoryCounts = {}
  gradesList.forEach(g => {
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

// Calculate what grade you need on remaining assignments to hit a target
function calcNeededScore(currentGrades, weights, targetCategory, targetPct) {
  const categoryScores = {}
  const categoryCounts = {}
  currentGrades.forEach(g => {
    const cat = g.category
    if (!categoryScores[cat]) { categoryScores[cat] = 0; categoryCounts[cat] = 0 }
    categoryScores[cat] += (g.score / g.maxScore) * 100
    categoryCounts[cat] += 1
  })

  // Total weight of graded categories (excluding target if it has no grades yet)
  let gradedWeighted = 0
  let gradedWeight = 0
  Object.entries(categoryScores).forEach(([cat, total]) => {
    if (cat === targetCategory) return
    const avg = total / categoryCounts[cat]
    const weight = getWeight(weights[cat])
    if (weight > 0) {
      gradedWeighted += avg * (weight / 100)
      gradedWeight += weight
    }
  })

  const targetWeight = getWeight(weights[targetCategory])
  if (targetWeight === 0) return null

  // If target category already has grades, include them
  if (categoryScores[targetCategory]) {
    const existingAvg = categoryScores[targetCategory] / categoryCounts[targetCategory]
    gradedWeighted += existingAvg * (targetWeight / 100)
    gradedWeight += targetWeight
  }

  // For ungraded categories (not target, not yet graded), assume they don't count yet
  const totalWeight = gradedWeight + (categoryScores[targetCategory] ? 0 : targetWeight)

  if (totalWeight === 0) return null

  // Solve: (gradedWeighted + score * targetWeight/100) / totalWeight * 100 = targetPct
  if (categoryScores[targetCategory]) {
    // Target category already has grades - can't calculate "needed" easily
    // Instead show what the new average needs to be
    return null
  }

  const neededScore = ((targetPct / 100) * totalWeight - gradedWeighted) / (targetWeight / 100)
  return Math.max(0, Math.min(100, neededScore))
}

const GRADE_THRESHOLDS = [
  { letter: 'A', min: 93, color: '#16a34a' },
  { letter: 'A-', min: 90, color: '#22c55e' },
  { letter: 'B+', min: 87, color: '#84cc16' },
  { letter: 'B', min: 83, color: '#eab308' },
  { letter: 'B-', min: 80, color: '#f59e0b' },
  { letter: 'C+', min: 77, color: '#f97316' },
  { letter: 'C', min: 73, color: '#ef4444' },
  { letter: 'C-', min: 70, color: '#dc2626' },
]

export default function WhatIfCalculator({ grades, courses }) {
  const [selectedCourse, setSelectedCourse] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [whatIfScore, setWhatIfScore] = useState(85)
  const [whatIfMax, setWhatIfMax] = useState(100)
  const [showNeeded, setShowNeeded] = useState(false)

  const courseWeights = grades?.courses || {}

  const currentPct = useMemo(() => {
    if (!selectedCourse || !courseWeights[selectedCourse]) return null
    const cData = courseWeights[selectedCourse]
    return calcPercentage(cData.grades || [], cData.weights || {})
  }, [selectedCourse, courseWeights])

  const whatIfPct = useMemo(() => {
    if (!selectedCourse || !selectedCategory || !courseWeights[selectedCourse]) return null
    const cData = courseWeights[selectedCourse]
    const existingGrades = [...(cData.grades || [])]
    // Add the hypothetical grade
    existingGrades.push({
      category: selectedCategory,
      score: whatIfScore,
      maxScore: whatIfMax,
    })
    return calcPercentage(existingGrades, cData.weights || {})
  }, [selectedCourse, selectedCategory, whatIfScore, whatIfMax, courseWeights])

  const gradeChange = (currentPct !== null && whatIfPct !== null) ? whatIfPct - currentPct : null
  const currentLetter = currentPct !== null ? letterGrade(currentPct) : '--'
  const whatIfLetter = whatIfPct !== null ? letterGrade(whatIfPct) : '--'

  const neededScores = useMemo(() => {
    if (!selectedCourse || !selectedCategory || !courseWeights[selectedCourse]) return []
    const cData = courseWeights[selectedCourse]
    return GRADE_THRESHOLDS.map(({ letter, min, color }) => {
      const needed = calcNeededScore(cData.grades || [], cData.weights || {}, selectedCategory, min)
      return { letter, min, color, needed }
    }).filter(x => x.needed !== null)
  }, [selectedCourse, selectedCategory, courseWeights])

  const currentWeightCategories = selectedCourse && courseWeights[selectedCourse]
    ? Object.keys(courseWeights[selectedCourse].weights || {})
    : []

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <Calculator size={22} className="text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">What-If Calculator</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">See how a grade would affect your class percentage</p>
        </div>
      </div>

      {/* Course + Category Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course</label>
          <select
            value={selectedCourse}
            onChange={e => { setSelectedCourse(e.target.value); setSelectedCategory('') }}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 text-sm"
          >
            <option value="">Pick a class...</option>
            {Object.keys(courseWeights).map(cId => (
              <option key={cId} value={cId}>{getCourseInfo(courses, cId).name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assignment Type</label>
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 text-sm"
            disabled={!selectedCourse}
          >
            <option value="">Pick assignment type...</option>
            {currentWeightCategories.map(cat => {
              const w = getWeight(courseWeights[selectedCourse].weights[cat])
              return <option key={cat} value={cat}>{cat} ({w.toFixed(0)}%)</option>
            })}
          </select>
        </div>
      </div>

      {/* Score Slider */}
      {selectedCourse && selectedCategory && (
        <div className="space-y-4">
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                What if you got...
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={whatIfScore}
                  onChange={e => setWhatIfScore(Number(e.target.value))}
                  className="w-16 text-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1 text-sm font-bold"
                  min={0}
                  max={whatIfMax}
                />
                <span className="text-gray-500 dark:text-gray-400 text-sm">/</span>
                <input
                  type="number"
                  value={whatIfMax}
                  onChange={e => setWhatIfMax(Number(e.target.value))}
                  className="w-16 text-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-1 text-sm"
                  min={1}
                />
              </div>
            </div>

            {/* Slider */}
            <div className="relative">
              <input
                type="range"
                min={0}
                max={whatIfMax}
                value={whatIfScore}
                onChange={e => setWhatIfScore(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>

            {/* Score as percentage */}
            <div className="text-center">
              <span className="text-3xl font-bold" style={{ color: COURSE_COLORS[selectedCourse] || '#6366f1' }}>
                {((whatIfScore / whatIfMax) * 100).toFixed(0)}%
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">on this {selectedCategory}</span>
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-3 gap-3">
            {/* Current Grade */}
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{currentLetter}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{currentPct !== null ? currentPct.toFixed(1) + '%' : '--'}</p>
            </div>

            {/* Arrow */}
            <div className="flex flex-col items-center justify-center">
              {gradeChange !== null && (
                <>
                  {gradeChange > 0 ? (
                    <TrendingUp size={28} className="text-green-500" />
                  ) : gradeChange < 0 ? (
                    <TrendingDown size={28} className="text-red-500" />
                  ) : (
                    <span className="text-2xl text-gray-400">=</span>
                  )}
                  <span className={`text-sm font-bold mt-1 ${
                    gradeChange > 0 ? 'text-green-500' : gradeChange < 0 ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    {gradeChange > 0 ? '+' : ''}{gradeChange.toFixed(2)}%
                  </span>
                </>
              )}
            </div>

            {/* New Grade */}
            <div className={`rounded-lg p-3 text-center ${
              whatIfLetter !== currentLetter && whatIfPct > currentPct
                ? 'bg-green-50 dark:bg-green-900/20 ring-2 ring-green-500'
                : whatIfLetter !== currentLetter && whatIfPct < currentPct
                ? 'bg-red-50 dark:bg-red-900/20 ring-2 ring-red-500'
                : 'bg-gray-50 dark:bg-gray-900/50'
            }`}>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">After</p>
              <p className={`text-2xl font-bold ${
                whatIfLetter !== currentLetter && whatIfPct > currentPct
                  ? 'text-green-600 dark:text-green-400'
                  : whatIfLetter !== currentLetter && whatIfPct < currentPct
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-900 dark:text-white'
              }`}>{whatIfLetter}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{whatIfPct !== null ? whatIfPct.toFixed(1) + '%' : '--'}</p>
            </div>
          </div>

          {/* Quick Score Buttons */}
          <div className="flex flex-wrap gap-2">
            {[0, 50, 60, 70, 75, 80, 85, 90, 95, 100].map(pct => (
              <button
                key={pct}
                onClick={() => setWhatIfScore(Math.round((pct / 100) * whatIfMax))}
                className={`px-3 py-1.5 text-xs rounded-full border transition-all ${
                  Math.round((whatIfScore / whatIfMax) * 100) === pct
                    ? 'bg-purple-600 text-white border-purple-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {pct}%
              </button>
            ))}
          </div>

          {/* "What do I need" section */}
          <button
            onClick={() => setShowNeeded(!showNeeded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg hover:from-purple-100 hover:to-indigo-100 dark:hover:from-purple-900/30 dark:hover:to-indigo-900/30 transition-all"
          >
            <div className="flex items-center gap-2">
              <Target size={16} className="text-purple-600 dark:text-purple-400" />
              <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                What score do I need for each letter grade?
              </span>
            </div>
            {showNeeded ? <ChevronUp size={16} className="text-purple-600" /> : <ChevronDown size={16} className="text-purple-600" />}
          </button>

          {showNeeded && neededScores.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {neededScores.map(({ letter, needed, color }) => (
                <div
                  key={letter}
                  className="rounded-lg p-3 text-center border border-gray-200 dark:border-gray-700"
                >
                  <p className="text-lg font-bold" style={{ color }}>{letter}</p>
                  <p className="text-sm font-mono text-gray-700 dark:text-gray-300">
                    {needed > 100 ? (
                      <span className="text-red-400 text-xs">Not possible</span>
                    ) : needed <= 0 ? (
                      <span className="text-green-400 text-xs">Guaranteed</span>
                    ) : (
                      `${needed.toFixed(0)}%`
                    )}
                  </p>
                  <p className="text-xs text-gray-400">needed</p>
                </div>
              ))}
            </div>
          )}

          {showNeeded && neededScores.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
              Need more existing grades to calculate minimums for this category.
            </p>
          )}
        </div>
      )}

      {/* Empty state */}
      {!selectedCourse && (
        <div className="text-center py-6 text-gray-400 dark:text-gray-500">
          <Calculator size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Select a course and assignment type to start</p>
        </div>
      )}
    </div>
  )
}
