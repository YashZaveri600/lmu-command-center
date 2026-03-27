/**
 * Sync orchestration module
 *
 * Pulls data from Brightspace API and upserts into PostgreSQL.
 * Ports the inferCategory logic from scripts/brightspace-sync.js.
 */

import brightspace from './brightspace.js'
import db from './db/index.js'
import { extractTasks } from './ai.js'

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
  // If we have a real category from Brightspace grade objects API, use it
  if (apiCategory) {
    return apiCategory
  }
  // Try name-based inference rules
  const rules = NAME_CATEGORY_RULES[appId]
  if (rules) {
    for (const rule of rules) {
      if (rule.match.test(gradeName)) return rule.category
    }
  }
  return 'Uncategorized'
}

// ─── Main sync function ───
export async function syncUserData(userId, cookie) {
  const results = { courses: 0, grades: 0, announcements: 0, tasks: 0, completed: 0, errors: [] }
  const allAnnouncements = [] // collect for AI analysis at end

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

      // Track graded item names for this course (used later to detect completed assignments)
      const gradedNames = new Set()

      // 3. Fetch grades + categories + grade objects for this course
      try {
        const [grades, categories, gradeObjects] = await Promise.all([
          brightspace.fetchGrades(enrollment.brightspaceId, cookie),
          brightspace.fetchCategories(enrollment.brightspaceId, cookie),
          brightspace.fetchGradeObjects(enrollment.brightspaceId, cookie),
        ])

        // Build weights from categories
        const weights = {}
        const categoryMap = {} // categoryId → categoryName
        if (categories.length > 0) {
          categories.forEach(cat => {
            if (cat.name && cat.weight > 0) {
              weights[cat.name] = { weight: cat.weight / 100 }
              if (cat.maxPoints) weights[cat.name].points = cat.maxPoints
            }
            categoryMap[cat.id] = cat.name
          })
        }

        // Build grade object lookup: gradeObjectId → categoryName
        // This is the KEY mapping — grade values don't have categories, grade objects do
        const gradeObjectCategoryMap = {}
        gradeObjects.forEach(obj => {
          if (obj.categoryId && categoryMap[obj.categoryId]) {
            gradeObjectCategoryMap[obj.id] = categoryMap[obj.categoryId]
          }
        })

        console.log(`[sync] ${appId}: categoryMap=${JSON.stringify(categoryMap)}, gradeObjCategories=${Object.keys(gradeObjectCategoryMap).length}/${gradeObjects.length}`)

        // Map grades with smart category inference
        // Filter out summary rows and invalid grades
        const SKIP_TYPES = ['Final Calculated Grade', 'Final Adjusted Grade', 'Category']
        const mappedGrades = grades
          .filter(g => g.maxPoints > 0 && g.points !== null && !SKIP_TYPES.includes(g.type))
          .map(g => ({
            id: `grade-${appId}-bs-${g.id}`,
            // Priority: 1) grade object category lookup, 2) name-based inference, 3) 'Uncategorized'
            category: inferCategory(appId, g.name, gradeObjectCategoryMap[g.id] || null),
            name: g.name,
            score: g.points ?? 0,
            maxScore: g.maxPoints ?? 100,
            date: g.date ? new Date(g.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          }))

        // Collect graded names for completion detection in step 5
        mappedGrades.forEach(g => gradedNames.add(g.name.toLowerCase().trim()))

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

          // Collect for AI analysis
          newItems.forEach(item => {
            allAnnouncements.push({
              title: item.title,
              body: item.body,
              course: appId,
              date: item.date,
              source: 'ai-announcement',
            })
          })
        }
      } catch (e) {
        console.error(`[sync] Error syncing announcements for ${appId}:`, e.message)
        results.errors.push(`${appId} announcements: ${e.message}`)
      }

      // 5. Fetch assignments (dropbox folders) — these are real tasks with due dates
      try {
        const assignments = await brightspace.fetchAssignments(enrollment.brightspaceId, cookie)
        const now = new Date()

        for (const assignment of assignments) {
          if (assignment.isHidden) continue

          // Parse due date
          const dueDate = assignment.dueDate ? new Date(assignment.dueDate).toISOString().split('T')[0] : null

          // Smart matching: check if this assignment has been graded
          // Uses word-overlap matching since names often differ
          // e.g. grade "Camelbak" matches assignment "Camelbak case study answers"
          // e.g. grade "Case study 1 Ethics Harmonix" matches assignment "ETHICS / HARMONIX"
          const assignmentNameLower = assignment.name.toLowerCase().trim()
          const assignmentWords = assignmentNameLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)

          const isGraded = [...gradedNames].some(gn => {
            // Exact match
            if (gn === assignmentNameLower) return true
            // One contains the other
            if (assignmentNameLower.includes(gn) || gn.includes(assignmentNameLower)) return true
            // Word overlap: if 50%+ of significant words match, consider it the same
            const gradeWords = gn.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
            if (gradeWords.length === 0 || assignmentWords.length === 0) return false
            const matchCount = assignmentWords.filter(w => gradeWords.some(gw => gw.includes(w) || w.includes(gw))).length
            return matchCount >= Math.min(assignmentWords.length, gradeWords.length) * 0.5
          })

          // Skip assignments that are past due AND already graded
          if (dueDate) {
            const due = new Date(dueDate)
            const daysPast = (now - due) / (1000 * 60 * 60 * 24)
            // Keep recent past-due items (7 days) even if not graded, but skip old graded ones
            if (daysPast > 7 && isGraded) continue
            // Skip very old assignments regardless
            if (daysPast > 30) continue
          }

          // Check if submitted on Brightspace (for non-graded items)
          let submitted = isGraded
          if (!submitted) {
            submitted = await brightspace.fetchMySubmissions(
              enrollment.brightspaceId,
              assignment.id,
              cookie
            )
          }

          // Determine priority based on due date
          let priority = 'medium'
          if (dueDate) {
            const daysUntil = (new Date(dueDate) - now) / (1000 * 60 * 60 * 24)
            if (daysUntil <= 2) priority = 'high'
            else if (daysUntil > 7) priority = 'low'
          }

          // Upsert as synced todo
          await db.upsertSyncedTodo(userId, {
            course: appId,
            task: assignment.name,
            due: dueDate,
            done: submitted,
            priority,
            source: 'brightspace',
            sourceId: `bs-assignment-${enrollment.brightspaceId}-${assignment.id}`,
          })
          results.tasks++
          if (submitted) results.completed++
        }
      } catch (e) {
        console.error(`[sync] Error syncing assignments for ${appId}:`, e.message)
        results.errors.push(`${appId} assignments: ${e.message}`)
      }

      // 6. Fetch quizzes — also real tasks
      try {
        const quizzes = await brightspace.fetchQuizzes(enrollment.brightspaceId, cookie)
        const now = new Date()

        for (const quiz of quizzes) {
          if (!quiz.isActive) continue

          const dueDate = quiz.dueDate ? new Date(quiz.dueDate).toISOString().split('T')[0] : null

          // Skip quizzes long past due
          if (dueDate) {
            const daysPast = (now - new Date(dueDate)) / (1000 * 60 * 60 * 24)
            if (daysPast > 7) continue
          }

          let priority = 'medium'
          if (dueDate) {
            const daysUntil = (new Date(dueDate) - now) / (1000 * 60 * 60 * 24)
            if (daysUntil <= 2) priority = 'high'
            else if (daysUntil > 7) priority = 'low'
          }

          // Check if already graded (means they took it)
          const quizNameLower = quiz.name.toLowerCase().trim()
          const quizWords = quizNameLower.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
          const isQuizGraded = [...gradedNames].some(gn => {
            if (gn === quizNameLower) return true
            if (quizNameLower.includes(gn) || gn.includes(quizNameLower)) return true
            const gradeWords = gn.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2)
            if (gradeWords.length === 0 || quizWords.length === 0) return false
            const matchCount = quizWords.filter(w => gradeWords.some(gw => gw.includes(w) || w.includes(gw))).length
            return matchCount >= Math.min(quizWords.length, gradeWords.length) * 0.5
          })

          await db.upsertSyncedTodo(userId, {
            course: appId,
            task: `Quiz: ${quiz.name}`,
            due: dueDate,
            done: isQuizGraded,
            priority,
            source: 'brightspace',
            sourceId: `bs-quiz-${enrollment.brightspaceId}-${quiz.id}`,
          })
          results.tasks++
        }
      } catch (e) {
        console.error(`[sync] Error syncing quizzes for ${appId}:`, e.message)
        // Quizzes endpoint may not be available — not a critical error
      }
    }

    // 7. AI-powered task extraction from announcements
    if (allAnnouncements.length > 0) {
      try {
        console.log(`[sync] Running AI analysis on ${allAnnouncements.length} announcements...`)
        const aiTasks = await extractTasks(allAnnouncements)
        for (const task of aiTasks) {
          await db.upsertSyncedTodo(userId, task)
          results.tasks++
        }
        if (aiTasks.length > 0) {
          console.log(`[sync] AI extracted ${aiTasks.length} tasks from announcements`)
        }
      } catch (e) {
        console.error('[sync] AI task extraction failed:', e.message)
        // Non-critical — AI is an enhancement, not required
      }
    }

    // Update last sync time
    await db.saveTokens(userId, 'brightspace_sync', {
      accessToken: 'last_sync',
      refreshToken: null,
      expiresAt: new Date(),
      scopes: JSON.stringify(results),
    })

    console.log(`[sync] Complete for user ${userId}: ${results.courses} courses, ${results.grades} grades, ${results.announcements} announcements, ${results.tasks} tasks (${results.completed} auto-completed)`)

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
