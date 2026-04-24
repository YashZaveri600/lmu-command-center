// Shared grade math helpers used across Grades page, What-If calculator,
// and anywhere else that needs to turn raw grades + category weights
// into a weighted percentage.
//
// The hard part: category names on GRADES don't always match category
// names on WEIGHTS. Example: a weight "Midterm Exam 1" may have grades
// filed under "Midterm 1". A weight "Case Studies" may have grades under
// "Case Studies 1-6". Both should be counted together, not treated as
// different categories.

export function getWeight(w) {
  if (typeof w === 'number') return w
  if (w && typeof w === 'object' && w.weight != null) return w.weight * 100
  return 0
}

// Normalize a category name for fuzzy comparison.
function normalize(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Given a grade's category name and the list of weight-category names for
// the course, return the best-matching weight category (or null if no match
// is good enough). This is how we tolerate naming drift between syllabus-
// extracted weights and Brightspace-provided grade categories.
export function matchGradeToWeightCategory(gradeCategoryName, weightCategoryNames) {
  if (!gradeCategoryName || !weightCategoryNames || weightCategoryNames.length === 0) return null

  // 1. Exact match wins immediately.
  if (weightCategoryNames.includes(gradeCategoryName)) return gradeCategoryName

  const gNorm = normalize(gradeCategoryName)
  if (!gNorm) return null

  // 2. Normalized exact match (case / punctuation differences only).
  for (const wc of weightCategoryNames) {
    if (normalize(wc) === gNorm) return wc
  }

  // 3. Score-based fuzzy match.
  let best = null
  let bestScore = 0

  for (const wc of weightCategoryNames) {
    const wNorm = normalize(wc)
    if (!wNorm) continue

    // Reject if both sides have digits and they don't share any.
    // Protects "Exam 1" from matching "Exam 2".
    const wNums = wNorm.match(/\d+/g) || []
    const gNums = gNorm.match(/\d+/g) || []
    if (wNums.length > 0 && gNums.length > 0) {
      const shared = wNums.some(n => gNums.includes(n))
      if (!shared) continue
    }

    let score = 0

    // Token overlap (significant words only)
    const stop = new Set(['the', 'and', 'of', 'for', 'in', 'on', 'at', 'a', 'an'])
    const wTokens = new Set(wNorm.split(/\s+/).filter(t => t.length >= 3 && !stop.has(t)))
    const gTokens = new Set(gNorm.split(/\s+/).filter(t => t.length >= 3 && !stop.has(t)))
    for (const t of wTokens) if (gTokens.has(t)) score += 2

    // Substring bonus — one fully contained in the other
    if (wNorm.includes(gNorm) || gNorm.includes(wNorm)) score += 3

    // Prefix match
    if (wNorm.startsWith(gNorm.split(' ')[0]) || gNorm.startsWith(wNorm.split(' ')[0])) score += 1

    if (score > bestScore) {
      bestScore = score
      best = wc
    }
  }

  // Minimum threshold — at least ~one shared significant token.
  return bestScore >= 2 ? best : null
}

// Compute the weighted percentage for a course.
// grades: [{ category, score, maxScore, ... }]
// weights: { [categoryName]: { weight, points? } | number }
// Uses fuzzy category matching so syllabus-extracted weight names can still
// pick up grades that Brightspace put in similarly-named categories.
export function calcCoursePercentage(grades, weights) {
  if (!grades || grades.length === 0 || !weights) return null
  const weightCategoryNames = Object.keys(weights)
  if (weightCategoryNames.length === 0) return null

  // Accumulate per-weight-category
  const catScores = {}
  const catCounts = {}
  for (const g of grades) {
    const matched = matchGradeToWeightCategory(g.category, weightCategoryNames)
    if (!matched) continue
    if (!catScores[matched]) { catScores[matched] = 0; catCounts[matched] = 0 }
    catScores[matched] += (g.score / g.maxScore) * 100
    catCounts[matched] += 1
  }

  let totalWeighted = 0
  let totalWeight = 0
  for (const [cat, sum] of Object.entries(catScores)) {
    const avg = sum / catCounts[cat]
    const w = getWeight(weights[cat])
    if (w > 0) {
      totalWeighted += avg * w
      totalWeight += w
    }
  }
  if (totalWeight === 0) return null
  return totalWeighted / totalWeight
}

// Returns a mapping from weight-category name -> { avg, count }.
// Useful for the "Grade breakdown" section on a course page.
export function categoryBreakdown(grades, weights) {
  const weightCategoryNames = Object.keys(weights || {})
  const out = {}
  for (const cat of weightCategoryNames) {
    out[cat] = { avg: null, count: 0, weight: getWeight(weights[cat]) }
  }
  if (!grades) return out

  const sums = {}
  const counts = {}
  for (const g of grades) {
    const matched = matchGradeToWeightCategory(g.category, weightCategoryNames)
    if (!matched) continue
    sums[matched] = (sums[matched] || 0) + (g.score / g.maxScore) * 100
    counts[matched] = (counts[matched] || 0) + 1
  }
  for (const cat of Object.keys(out)) {
    if (counts[cat]) {
      out[cat].avg = sums[cat] / counts[cat]
      out[cat].count = counts[cat]
    }
  }
  return out
}
