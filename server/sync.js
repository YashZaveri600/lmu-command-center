/**
 * Sync orchestration module
 *
 * Pulls data from Brightspace API and upserts into PostgreSQL.
 * Ports the inferCategory logic from scripts/brightspace-sync.js.
 */

import brightspace from './brightspace.js'
import db from './db/index.js'

// ─── Course mapping ───
// Maps Brightspace course IDs to our short app IDs
// For new users, this is auto-detected from enrollment data + course names
const KNOWN_COURSE_PATTERNS = [
  { match: /managing.*people|BCOR.*3610/i, appId: 'managing', color: '#3B82F6' },
  { match: /accounting|BCOR.*2120/i, appId: 'accounting', color: '#10B981' },
  { match: /philosoph|PHIL/i, appId: 'philosophy', color: '#8B5CF6' },
  { match: /marketing|BCOR.*3510/i, appId: 'marketing', color: '#F59E0B' },
  { match: /finance|BCOR.*2020/i, appId: 'finance', color: '#EF4444' },
  { match: /economics|ECON/i, appId: 'economics', color: '#06B6D4' },
  { match: /english|ENGL/i, appId: 'english', color: '#EC4899' },
  { match: /math|MATH/i, appId: 'math', color: '#14B8A6' },
  { match: /computer|CMSI/i, appId: 'compsci', color: '#6366F1' },
  { match: /history|HIST/i, appId: 'history', color: '#D97706' },
  { match: /psychology|PSYC/i, appId: 'psychology', color: '#7C3AED' },
  { match: /communication|COMM/i, appId: 'comm', color: '#F97316' },
  { match: /biology|BIOL/i, appId: 'biology', color: '#22C55E' },
  { match: /theology|THEO/i, appId: 'theology', color: '#A855F7' },
]

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#14B8A6']

function generateAppId(courseName, code) {
  // Try known patterns first
  const fullStr = `${courseName} ${code}`
  for (const pattern of KNOWN_COURSE_PATTERNS) {
    if (pattern.match.test(fullStr)) return { appId: pattern.appId, color: pattern.color }
  }
  // Fallback: sanitize the name
  const appId = courseName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
  const colorIdx = Math.abs(appId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length
  return { appId, color: COLORS[colorIdx] }
}

// ─── Name-based category inference ───
// When Brightspace doesn't assign proper categories, infer from grade name
const NAME_CATEGORY_RULES = {
  managing: [
    { match: /exam/i, category: 'Exam 1' },
    { match: /mentor/i, category: 'Mentoring Assignment' },
    { match: /field\s*project|group.*project/i, category: 'Group Field Project' },
    { match: /presentation/i, category: 'Individual Presentation' },
    { match: /attendance|participation/i, category: 'Attendance/Participation' },
    { match: /peer\s*eval/i, category: 'Peer Evaluation' },
    { match: /cba\s*advantage/i, category: 'CBA Advantage Points' },
    { match: /connect|application|organizational|leadership|human\s*resource|power.*influence|behavior/i, category: 'Connect Homework' },
  ],
  accounting: [
    { match: /midterm\s*1/i, category: 'Midterm 1' },
    { match: /midterm\s*2/i, category: 'Midterm 2' },
    { match: /final/i, category: 'Final Exam' },
    { match: /discussion/i, category: 'Discussion Questions' },
    { match: /class\s*assignment|classwork/i, category: 'Classwork' },
    { match: /group\s*project/i, category: 'Group Project' },
    { match: /hw|homework/i, category: 'Homework' },
  ],
  philosophy: [
    { match: /quiz/i, category: 'Quizzes' },
    { match: /paper|republic|position/i, category: 'Paper' },
    { match: /final/i, category: 'Final Exam' },
    { match: /allegory|cave/i, category: 'Quizzes' },
  ],
  marketing: [
    { match: /case\s*study/i, category: 'Case Studies 1-6' },
    { match: /mid\s*term|midterm/i, category: 'Midterm' },
    { match: /final/i, category: 'Final Exam' },
    { match: /oral|check.?in/i, category: 'Oral Individual Check-ins' },
    { match: /participa/i, category: 'Class Participation' },
    { match: /group|project|app\s*project/i, category: 'Group Project Final' },
    { match: /pitch/i, category: 'Group Project Final' },
    { match: /disney|camelbak|starbucks|harmonix|pepsico|uber/i, category: 'Case Studies 1-6' },
  ],
}

function inferCategory(appId, gradeName, apiCategory) {
  // These are Brightspace grade TYPE names, not actual categories — skip them
  const IGNORE_TYPES = ['Uncategorized', 'Numeric', 'Pass/Fail', 'Category', 'Text', 'Formula', 'Calculated', 'Final Calculated Grade', 'Final Adjusted Grade']
  if (apiCategory && !IGNORE_TYPES.includes(apiCategory)) {
    return apiCategory
  }
  const rules = NAME_CATEGORY_RULES[appId]
  if (rules) {
    for (const rule of rules) {
      if (rule.match.test(gradeName)) return rule.category
    }
  }
  return apiCategory || 'Uncategorized'
}

// ─── Main sync function ───
export async function syncUserData(userId, cookie) {
  const results = { courses: 0, grades: 0, announcements: 0, errors: [] }

  try {
    // 1. Fetch enrollments from Brightspace API
    console.log(`[sync] Starting sync for user ${userId}...`)
    const enrollments = await brightspace.fetchEnrollments(cookie)
    console.log(`[sync] Found ${enrollments.length} enrolled courses`)

    // Filter to likely current-semester courses (skip old/inactive)
    const activeCourses = enrollments.filter(e => {
      const name = e.name.toLowerCase()
      return !name.includes('sandbox') && !name.includes('test') && !name.includes('template')
    })

    if (activeCourses.length === 0) {
      results.errors.push('No courses found from Brightspace. Your session may have expired — try reconnecting.')
      return results
    }

    // 2. Sync each course
    for (const enrollment of activeCourses) {
      // Extract course code from name like "Spring 2026 Marketing (BCOR-3510-12)" → "BCOR-3510"
      const codeMatch = enrollment.name.match(/\(([A-Z]{2,4}-\d{3,4}[^)]*)\)/)
      const extractedCode = codeMatch ? codeMatch[1].split('-').slice(0, 2).join('-') : null

      // Clean course name: remove "Spring 2026" prefix and "(BCOR-3510-12)" suffix
      const cleanName = enrollment.name
        .replace(/^(Spring|Fall|Summer)\s+\d{4}\s+/i, '')
        .replace(/\s*\([A-Z]{2,4}-[^)]+\)\s*$/, '')
        .trim()

      const { appId, color } = generateAppId(cleanName, enrollment.code)
      const shortCode = extractedCode || enrollment.code?.split('-').slice(0, 2).join('-') || appId.toUpperCase()

      // Upsert course with clean name
      await db.upsertCourse(userId, {
        brightspaceId: enrollment.brightspaceId,
        id: appId,
        name: cleanName,
        shortCode,
        color,
        professor: null,
        schedule: [],
        folders: [],
      })
      results.courses++

      // 3. Fetch grades + categories for this course
      try {
        const [grades, categories] = await Promise.all([
          brightspace.fetchGrades(enrollment.brightspaceId, cookie),
          brightspace.fetchCategories(enrollment.brightspaceId, cookie),
        ])

        // Build weights from categories
        const weights = {}
        if (categories.length > 0) {
          categories.forEach(cat => {
            if (cat.name && cat.weight > 0) {
              weights[cat.name] = { weight: cat.weight / 100 }
              if (cat.maxPoints) weights[cat.name].points = cat.maxPoints
            }
          })
        }

        // Build category lookup from grade objects (for category mapping)
        const categoryMap = {}
        categories.forEach(cat => { categoryMap[cat.id] = cat.name })

        // Map grades with smart category inference
        // Filter out summary rows and invalid grades
        const SKIP_TYPES = ['Final Calculated Grade', 'Final Adjusted Grade', 'Category']
        const mappedGrades = grades
          .filter(g => g.maxPoints > 0 && g.points !== null && !SKIP_TYPES.includes(g.type))
          .map(g => ({
            id: `grade-${appId}-bs-${g.id}`,
            category: inferCategory(appId, g.name, categoryMap[g.categoryId] || g.type),
            name: g.name,
            score: g.points ?? 0,
            maxScore: g.maxPoints ?? 100,
            date: g.date ? new Date(g.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          }))

        // Only upsert grades if we actually got some — don't wipe existing data
        // when the API returns 403 or empty results for a duplicate course entry
        if (mappedGrades.length > 0 || grades.length === 0) {
          await db.upsertGrades(userId, appId, { weights, grades: mappedGrades })
          results.grades += mappedGrades.length
          console.log(`[sync] ${appId}: ${mappedGrades.length} grades, ${Object.keys(weights).length} categories`)
        } else {
          // API returned grades but all were filtered out (summary rows only) — still update weights
          console.log(`[sync] ${appId}: skipping grade upsert (${grades.length} raw grades all filtered out, preserving existing)`)
          if (Object.keys(weights).length > 0) {
            await db.upsertGrades(userId, appId, { weights, grades: [] })
          }
        }

      } catch (e) {
        console.error(`[sync] Error syncing grades for ${appId}:`, e.message)
        results.errors.push(`${appId} grades: ${e.message}`)
      }

      // 4. Fetch announcements
      try {
        const news = await brightspace.fetchAnnouncements(enrollment.brightspaceId, cookie)
        const mappedNews = news.map(item => ({
          course: appId,
          title: item.title,
          body: item.body || '',
          date: item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          type: 'announcement',
          read: false,
        }))

        // Get existing announcements and append new ones
        if (mappedNews.length > 0) {
          const existing = await db.getUpdates(userId)
          // Dedupe by title + course
          const existingKeys = new Set(existing.map(u => `${u.course}|${u.title}`))
          const newItems = mappedNews.filter(item => !existingKeys.has(`${item.course}|${item.title}`))

          if (newItems.length > 0) {
            const combined = [...existing, ...newItems]
            await db.upsertUpdates(userId, combined)
            results.announcements += newItems.length
          }
        }
      } catch (e) {
        console.error(`[sync] Error syncing announcements for ${appId}:`, e.message)
        results.errors.push(`${appId} announcements: ${e.message}`)
      }
    }

    // Update last sync time
    await db.saveTokens(userId, 'brightspace_sync', {
      accessToken: 'last_sync',
      refreshToken: null,
      expiresAt: new Date(),
      scopes: JSON.stringify(results),
    })

    console.log(`[sync] Complete for user ${userId}: ${results.courses} courses, ${results.grades} grades, ${results.announcements} new announcements`)

  } catch (e) {
    if (e.message === 'BRIGHTSPACE_SESSION_EXPIRED') {
      results.errors.push('Brightspace session expired. Please reconnect.')
    } else {
      results.errors.push(e.message)
    }
    console.error(`[sync] Failed for user ${userId}:`, e.message)
  }

  return results
}

export default { syncUserData }
