import React, { useState, useMemo } from 'react'
import { Calculator, Target, TrendingDown, TrendingUp, Plus, X } from 'lucide-react'
import { getCourseInfo } from '../hooks/useData'

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

function getWeight(w) {
  if (typeof w === 'number') return w
  if (w && typeof w === 'object' && w.weight != null) return w.weight * 100
  return 0
}

// Overall percentage = weighted average of graded category averages.
// Categories with weight but no grades are ignored in the denominator
// (matches how Brightspace shows in-progress grades).
function calcPercentage(gradesList, weights) {
  if (!gradesList || gradesList.length === 0 || !weights) return null
  const catSum = {}
  const catCount = {}
  gradesList.forEach(g => {
    const cat = g.category
    if (!catSum[cat]) { catSum[cat] = 0; catCount[cat] = 0 }
    catSum[cat] += (g.score / g.maxScore) * 100
    catCount[cat] += 1
  })
  let totalWeighted = 0
  let totalWeight = 0
  Object.entries(catSum).forEach(([cat, sum]) => {
    const avg = sum / catCount[cat]
    const weight = getWeight(weights[cat])
    if (weight > 0) {
      totalWeighted += avg * weight
      totalWeight += weight
    }
  })
  if (totalWeight === 0) return null
  return totalWeighted / totalWeight
}

// What score do I need on ONE more grade in the target category
// so that my overall grade hits targetPct?
// Works correctly whether the category has existing grades or not.
function calcNeededScore(grades, weights, targetCategory, targetPct) {
  const catSum = {}
  const catCount = {}
  for (const g of (grades || [])) {
    if (!catSum[g.category]) { catSum[g.category] = 0; catCount[g.category] = 0 }
    catSum[g.category] += (g.score / g.maxScore) * 100
    catCount[g.category] += 1
  }

  const targetWeight = getWeight(weights[targetCategory])
  if (targetWeight <= 0) return null

  // Weighted sum + weight of all OTHER categories that already have grades.
  let otherWeighted = 0
  let otherWeight = 0
  for (const cat of Object.keys(weights)) {
    const w = getWeight(weights[cat])
    if (w <= 0) continue
    if (cat === targetCategory) continue
    if (!catSum[cat]) continue
    const avg = catSum[cat] / catCount[cat]
    otherWeighted += avg * w
    otherWeight += w
  }

  const totalDenom = otherWeight + targetWeight
  if (totalDenom <= 0) return null

  // Required NEW category average after adding one more grade.
  const requiredTargetAvg = (targetPct * totalDenom - otherWeighted) / targetWeight

  const existingSum = catSum[targetCategory] || 0
  const existingCount = catCount[targetCategory] || 0

  // What does the (n+1)th score need to be so the new category avg = requiredTargetAvg?
  return requiredTargetAvg * (existingCount + 1) - existingSum
}

const GRADE_THRESHOLDS = [
  { letter: 'A', min: 93, color: '#16a34a' },
  { letter: 'A-', min: 90, color: '#22c55e' },
  { letter: 'B+', min: 87, color: '#65a30d' },
  { letter: 'B', min: 83, color: '#ca8a04' },
  { letter: 'B-', min: 80, color: '#eab308' },
  { letter: 'C+', min: 77, color: '#f97316' },
  { letter: 'C', min: 73, color: '#ef4444' },
  { letter: 'C-', min: 70, color: '#dc2626' },
]

export default function WhatIfCalculator({ grades, courses }) {
  const [selectedCourse, setSelectedCourse] = useState('')

  // Stacking state (independent from "what do I need")
  const [whatIfGrades, setWhatIfGrades] = useState([]) // { id, category, score, maxScore }
  const [addCategory, setAddCategory] = useState('')
  const [addScore, setAddScore] = useState(85)
  const [addMax, setAddMax] = useState(100)

  // "What do I need" state (independent category picker)
  const [neededCategory, setNeededCategory] = useState('')

  const courseWeights = grades?.courses || {}
  const cData = selectedCourse ? courseWeights[selectedCourse] : null
  const weightCategories = cData ? Object.keys(cData.weights || {}) : []

  // Current + projected percentages
  const currentPct = useMemo(() => {
    if (!cData) return null
    return calcPercentage(cData.grades || [], cData.weights || {})
  }, [cData])

  const allGradesWithWhatIfs = useMemo(() => {
    if (!cData) return []
    return [...(cData.grades || []), ...whatIfGrades]
  }, [cData, whatIfGrades])

  const whatIfPct = useMemo(() => {
    if (!cData || whatIfGrades.length === 0) return null
    return calcPercentage(allGradesWithWhatIfs, cData.weights || {})
  }, [cData, whatIfGrades, allGradesWithWhatIfs])

  const gradeChange = (currentPct !== null && whatIfPct !== null) ? whatIfPct - currentPct : null
  const currentLetter = currentPct !== null ? letterGrade(currentPct) : '--'
  const whatIfLetter = whatIfPct !== null ? letterGrade(whatIfPct) : '--'

  // "What do I need" — ALWAYS computed, always visible once a category is picked.
  // Respects any stacked what-if grades in the calculation.
  const neededScores = useMemo(() => {
    if (!cData || !neededCategory) return []
    return GRADE_THRESHOLDS.map(({ letter, min, color }) => {
      const needed = calcNeededScore(allGradesWithWhatIfs, cData.weights || {}, neededCategory, min)
      return { letter, min, color, needed }
    })
  }, [cData, neededCategory, allGradesWithWhatIfs])

  function addWhatIfGrade() {
    if (!addCategory) return
    setWhatIfGrades(prev => [...prev, {
      id: Date.now(),
      category: addCategory,
      score: addScore,
      maxScore: addMax,
    }])
    setAddScore(85)
    setAddMax(100)
  }

  function removeWhatIfGrade(id) {
    setWhatIfGrades(prev => prev.filter(g => g.id !== id))
  }

  function handleCourseChange(courseId) {
    setSelectedCourse(courseId)
    setAddCategory('')
    setNeededCategory('')
    setWhatIfGrades([])
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <Calculator size={22} className="text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">What-If Calculator</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">See how future grades affect your final — and what you need to hit each letter.</p>
        </div>
      </div>

      {/* Course Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Course</label>
        <select
          value={selectedCourse}
          onChange={e => handleCourseChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2.5 text-sm"
        >
          <option value="">Pick a class...</option>
          {Object.keys(courseWeights).map(cId => (
            <option key={cId} value={cId}>{getCourseInfo(courses, cId).name}</option>
          ))}
        </select>
      </div>

      {/* Empty state */}
      {!selectedCourse && (
        <div className="text-center py-6 text-gray-400 dark:text-gray-500">
          <Calculator size={40} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Select a course to get started</p>
        </div>
      )}

      {selectedCourse && (
        <>
          {/* SECTION 1 — Current Grade */}
          <Section title="Current Grade">
            <div className="grid grid-cols-2 gap-3">
              <ResultCard
                label="Current"
                letter={currentLetter}
                pct={currentPct}
              />
              <ResultCard
                label={whatIfGrades.length > 0 ? 'With hypotheticals' : 'No hypotheticals yet'}
                letter={whatIfGrades.length > 0 ? whatIfLetter : currentLetter}
                pct={whatIfGrades.length > 0 ? whatIfPct : currentPct}
                delta={gradeChange}
                highlight={whatIfGrades.length > 0}
              />
            </div>
          </Section>

          {/* SECTION 2 — Stack Hypothetical Grades */}
          <Section title="Stack Hypothetical Grades" subtitle="Add one or more fake grades to see the combined effect.">
            <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Category</label>
                  <select
                    value={addCategory}
                    onChange={e => setAddCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm"
                  >
                    <option value="">Pick category...</option>
                    {weightCategories.map(cat => {
                      const w = getWeight(cData.weights[cat])
                      return <option key={cat} value={cat}>{cat} ({w.toFixed(0)}%)</option>
                    })}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Score</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={addScore}
                      onChange={e => setAddScore(Number(e.target.value))}
                      className="w-20 text-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-2 text-sm font-bold"
                      min={0}
                    />
                    <span className="text-gray-500 dark:text-gray-400 text-sm">/</span>
                    <input
                      type="number"
                      value={addMax}
                      onChange={e => setAddMax(Number(e.target.value))}
                      className="w-20 text-center rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-2 py-2 text-sm"
                      min={1}
                    />
                  </div>
                </div>
              </div>

              {addCategory && addMax > 0 && (
                <>
                  <input
                    type="range"
                    min={0}
                    max={addMax}
                    value={addScore}
                    onChange={e => setAddScore(Number(e.target.value))}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>0%</span>
                    <span className="font-bold text-purple-600 dark:text-purple-400">{((addScore / addMax) * 100).toFixed(0)}%</span>
                    <span>100%</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[50, 60, 70, 80, 85, 90, 95, 100].map(pct => (
                      <button
                        key={pct}
                        onClick={() => setAddScore(Math.round((pct / 100) * addMax))}
                        className={`px-3 py-1 text-xs rounded-full border transition-all ${
                          Math.round((addScore / addMax) * 100) === pct
                            ? 'bg-purple-600 text-white border-purple-600'
                            : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </>
              )}

              <button
                onClick={addWhatIfGrade}
                disabled={!addCategory || addMax <= 0}
                className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Plus size={16} /> Add Hypothetical Grade
              </button>
            </div>

            {whatIfGrades.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Added ({whatIfGrades.length})</p>
                {whatIfGrades.map(g => (
                  <div key={g.id} className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg px-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-purple-700 dark:text-purple-300 bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 rounded">{g.category}</span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{g.score}/{g.maxScore}</span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">({((g.score / g.maxScore) * 100).toFixed(0)}%)</span>
                    </div>
                    <button onClick={() => removeWhatIfGrade(g.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* SECTION 3 — What do I need */}
          <Section
            title="What Score Do I Need?"
            subtitle="Pick a category to see what your next grade needs to be for each letter."
          >
            <select
              value={neededCategory}
              onChange={e => setNeededCategory(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm mb-3"
            >
              <option value="">Pick category...</option>
              {weightCategories.map(cat => {
                const w = getWeight(cData.weights[cat])
                return <option key={cat} value={cat}>{cat} ({w.toFixed(0)}%)</option>
              })}
            </select>

            {neededCategory && neededScores.length > 0 && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {neededScores.map(({ letter, needed, color }) => (
                    <div
                      key={letter}
                      className="rounded-lg p-3 text-center border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50"
                    >
                      <p className="text-lg font-bold" style={{ color }}>{letter}</p>
                      <p className="text-sm font-mono text-gray-700 dark:text-gray-300 mt-0.5">
                        {needed > 100 ? (
                          <span className="text-red-500 dark:text-red-400 text-[11px] font-semibold">Not possible</span>
                        ) : needed <= 0 ? (
                          <span className="text-green-500 dark:text-green-400 text-[11px] font-semibold">Guaranteed</span>
                        ) : (
                          <span>{needed.toFixed(0)}%</span>
                        )}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-0.5">on next grade</p>
                    </div>
                  ))}
                </div>
                {whatIfGrades.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                    Includes your {whatIfGrades.length} stacked hypothetical{whatIfGrades.length === 1 ? '' : 's'} above.
                  </p>
                )}
              </>
            )}

            {!neededCategory && (
              <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-3 flex items-center justify-center gap-2">
                <Target size={14} /> Pick a category above to see required scores.
              </div>
            )}
          </Section>
        </>
      )}
    </div>
  )
}

// ─── Small presentational helpers ───

function Section({ title, subtitle, children }) {
  return (
    <div className="border-t border-gray-100 dark:border-gray-700 pt-5 first:border-t-0 first:pt-0">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h4>
      {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-3">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  )
}

function ResultCard({ label, letter, pct, delta, highlight }) {
  const deltaPositive = delta !== null && delta !== undefined && delta > 0
  const deltaNegative = delta !== null && delta !== undefined && delta < 0
  return (
    <div className={`rounded-lg p-3 text-center ${
      highlight && deltaPositive
        ? 'bg-green-50 dark:bg-green-900/20 ring-1 ring-green-400'
        : highlight && deltaNegative
        ? 'bg-red-50 dark:bg-red-900/20 ring-1 ring-red-400'
        : 'bg-gray-50 dark:bg-gray-900/50'
    }`}>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${
        highlight && deltaPositive
          ? 'text-green-600 dark:text-green-400'
          : highlight && deltaNegative
          ? 'text-red-600 dark:text-red-400'
          : 'text-gray-900 dark:text-white'
      }`}>{letter}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{pct !== null && pct !== undefined ? pct.toFixed(1) + '%' : '--'}</p>
      {delta !== null && delta !== undefined && (
        <p className={`text-[11px] font-semibold mt-1 flex items-center justify-center gap-1 ${
          deltaPositive ? 'text-green-500' : deltaNegative ? 'text-red-500' : 'text-gray-400'
        }`}>
          {deltaPositive ? <TrendingUp size={11} /> : deltaNegative ? <TrendingDown size={11} /> : null}
          {deltaPositive ? '+' : ''}{delta.toFixed(2)}%
        </p>
      )}
    </div>
  )
}
