/**
 * Sync orchestration module
 *
 * Pulls data from Brightspace API and upserts into PostgreSQL.
 * Ports the inferCategory logic from scripts/brightspace-sync.js.
 */

import brightspace from './brightspace.js'
import db from './db/index.js'
import { extractTasks, extractWeightsFromSyllabus } from './ai.js'

// Broadened syllabus detection — any title that sounds like a syllabus/course-info doc.
// Does NOT use \b word boundaries because filenames like "BIOL_3020_S2_Syllabus"
// have underscores (word chars) instead of spaces, so \b misses them.
function findSyllabusItem(items) {
  if (!items || items.length === 0) return null
  const leafTypes = ['file', 'page', 'link', 'pdf', 'pptx', 'docx']
  const patterns = [
    /syllabus/i,
    /course\s*info(rmation)?/i,
    /course\s*overview/i,
    /welcome/i,
    /course\s*outline/i,
    /course\s*schedule/i,
    /getting\s*started/i,
  ]
  // Prefer a leaf file match first. Among leaves, prefer those with URLs
  // that look readable (PDF/HTML/docx over modules-masquerading-as-links).
  const readable = (c) => c.url && /\.(pdf|docx?|html?|txt)(\?|$|#)/i.test(c.url)

  for (const rx of patterns) {
    // First pass: readable file extension + leaf type
    const best = items.find(c => rx.test(c.title || '') && leafTypes.includes(c.type) && readable(c))
    if (best) return best
  }
  for (const rx of patterns) {
    // Second pass: any leaf that matches
    const leaf = items.find(c => rx.test(c.title || '') && leafTypes.includes(c.type))
    if (leaf) return leaf
  }
  for (const rx of patterns) {
    // Third pass: any match at all
    const any = items.find(c => rx.test(c.title || ''))
    if (any) return any
  }
  return null
}

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
  const results = { courses: 0, grades: 0, announcements: 0, tasks: 0, completed: 0, content: 0, errors: [] }
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
            feedback: g.feedback || null,
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
          source_url: item.source_url || null,
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

      // 4b. Fetch course content modules (files, links, pages)
      // Hard 15s budget per course so a slow course cannot hang the whole sync.
      try {
        const contentPromise = brightspace.fetchCourseContent(enrollment.brightspaceId, cookie)
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('content sync timeout')), 15_000)
        )
        const content = await Promise.race([contentPromise, timeout])
        if (content && content.length > 0) {
          await db.upsertCourseContent(userId, appId, content)
          results.content += content.length
          console.log(`[sync] ${appId}: ${content.length} content items`)
        }
      } catch (e) {
        console.error(`[sync] Skip content for ${appId}: ${e.message}`)
        // Do not push to results.errors — content sync is best-effort, never a hard failure
      }

      // 4c. Fetch Brightspace calendar events — best-effort, 8s budget per course
      try {
        const eventsPromise = brightspace.fetchCalendarEvents(enrollment.brightspaceId, cookie)
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('calendar sync timeout')), 8_000)
        )
        const events = await Promise.race([eventsPromise, timeout])
        if (Array.isArray(events)) {
          await db.upsertCalendarEvents(userId, appId, events)
          if (events.length > 0) {
            console.log(`[sync] ${appId}: ${events.length} calendar events`)
          }
        }
      } catch (e) {
        console.error(`[sync] Skip calendar for ${appId}: ${e.message}`)
        // Best-effort, not a hard failure
      }

      // 4d. Auto-extract grade weights from syllabus (if Brightspace weights are missing)
      // Best-effort: 20s budget total per course (download + AI call).
      try {
        // Only try if no Brightspace weights came through for this course
        const existingWeights = await db.pool.query(
          `SELECT COUNT(*) AS n FROM grade_weights WHERE user_id = $1 AND course_app_id = $2 AND source = 'brightspace'`,
          [userId, appId]
        )
        const hasBrightspaceWeights = Number(existingWeights.rows[0]?.n || 0) > 0

        if (!hasBrightspaceWeights) {
          // Look up the synced content and find a syllabus-like file
          const allContent = await db.getCourseContent(userId)
          const courseItems = allContent.filter(c => c.course === appId)
          const syllabus = findSyllabusItem(courseItems)

          if (syllabus) {
            // Extract bsId number from "topic-12345"
            const topicId = String(syllabus.bsId || '').replace(/^topic-/, '')
            if (topicId && /^\d+$/.test(topicId)) {
              console.log(`[sync] ${appId}: attempting syllabus weight extraction from "${syllabus.title}"`)
              const syllabusTextPromise = brightspace.fetchTopicText(enrollment.brightspaceId, topicId, cookie)
              const textTimeout = new Promise(resolve => setTimeout(() => resolve(null), 10_000))
              const syllabusText = await Promise.race([syllabusTextPromise, textTimeout])

              if (syllabusText && syllabusText.length > 200) {
                const aiTimeout = new Promise(resolve => setTimeout(() => resolve(null), 10_000))
                const weightsResult = await Promise.race([
                  extractWeightsFromSyllabus(syllabusText, enrollment.name),
                  aiTimeout,
                ])
                if (weightsResult?.weights) {
                  const inserted = await db.upsertWeightsFromSyllabus(userId, appId, weightsResult.weights)
                  if (inserted > 0) {
                    console.log(`[sync] ${appId}: extracted ${inserted} weights from syllabus (confidence: ${weightsResult.confidence})`)
                  }
                } else {
                  console.log(`[sync] ${appId}: AI couldn't extract clear weights from syllabus`)
                }
              } else {
                console.log(`[sync] ${appId}: syllabus text too short or unreadable (${syllabusText?.length || 0} chars)`)
              }
            }
          } else {
            console.log(`[sync] ${appId}: no syllabus-like file found to extract weights from`)
          }
        }
      } catch (e) {
        console.error(`[sync] Syllabus weight extraction skipped for ${appId}: ${e.message}`)
        // Best-effort, never a hard failure
      }

      // 5. Fetch assignments (dropbox folders) — these are real tasks with due dates
      // Completion is determined by: submission detected OR name matches a graded item.
      try {
        const assignments = await brightspace.fetchAssignments(enrollment.brightspaceId, cookie)
        const now = new Date()

        for (const assignment of assignments) {
          if (assignment.isHidden) continue

          const dueDate = assignment.dueDate ? new Date(assignment.dueDate).toISOString().split('T')[0] : null
          const endDate = assignment.endDate ? new Date(assignment.endDate).toISOString().split('T')[0] : null

          // We now KEEP assignments with no date at all (common for papers / projects).
          // They show up with no due date until the prof sets one or it gets graded.
          const effectiveDate = dueDate || endDate

          // Gate on "relevance" only when we have a date.
          // Extended future window to 180 days so next-semester-ish items still appear.
          if (effectiveDate) {
            const daysUntil = (new Date(effectiveDate) - now) / (1000 * 60 * 60 * 24)
            if (daysUntil > 180) continue
          }

          // Check submission status + fetch rubric in parallel.
          // Rubric is best-effort (6s timeout); most assignments have none.
          const rubricPromise = Promise.race([
            brightspace.fetchAssignmentRubrics(enrollment.brightspaceId, assignment.id, cookie),
            new Promise(resolve => setTimeout(() => resolve([]), 6_000)),
          ]).catch(() => [])

          const [submitted, rubrics] = await Promise.all([
            brightspace.fetchMySubmissions(enrollment.brightspaceId, assignment.id, cookie),
            rubricPromise,
          ])

          // Grade-name fallback — same approach we use for quizzes.
          // If a graded item exists whose name matches the assignment, count it as done.
          // This handles cases where the prof graded but dropbox submission wasn't detected.
          let gradeMatched = false
          const nameLower = (assignment.name || '').toLowerCase().trim()
          if (nameLower) {
            gradeMatched = [...gradedNames].some(gn =>
              gn === nameLower || gn.includes(nameLower) || nameLower.includes(gn)
            )
          }

          const isDone = submitted || gradeMatched
          const daysUntil = effectiveDate
            ? (new Date(effectiveDate) - now) / (1000 * 60 * 60 * 24)
            : null
          const isOverdue = daysUntil !== null && daysUntil < 0 && !isDone

          // Skip old completed assignments (more than 7 days ago and done)
          if (daysUntil !== null && daysUntil < -7 && isDone) continue

          // Priority: overdue = high, due soon = high, far out = low, no date = medium
          let priority = 'medium'
          if (daysUntil !== null) {
            if (isOverdue || (daysUntil <= 2 && daysUntil >= 0)) priority = 'high'
            else if (daysUntil > 7) priority = 'low'
          }

          await db.upsertSyncedTodo(userId, {
            course: appId,
            task: assignment.name,
            due: dueDate,
            done: isDone,
            priority,
            source: 'brightspace',
            sourceId: `bs-assignment-${enrollment.brightspaceId}-${assignment.id}`,
            rubric: Array.isArray(rubrics) && rubrics.length > 0 ? rubrics : null,
          })
          results.tasks++
          if (isDone) results.completed++
        }
      } catch (e) {
        console.error(`[sync] Error syncing assignments for ${appId}:`, e.message)
        results.errors.push(`${appId} assignments: ${e.message}`)
      }

      // 6. Fetch quizzes — check actual attempts instead of just grade name matching
      try {
        const quizzes = await brightspace.fetchQuizzes(enrollment.brightspaceId, cookie)
        const now = new Date()

        for (const quiz of quizzes) {
          if (!quiz.isActive) continue

          const dueDate = quiz.dueDate ? new Date(quiz.dueDate).toISOString().split('T')[0] : null
          if (!dueDate) continue

          const daysUntil = (new Date(dueDate) - now) / (1000 * 60 * 60 * 24)
          if (daysUntil > 60) continue

          // Check actual quiz attempts first, fall back to grade name matching
          let isDone = await brightspace.fetchQuizAttempts(enrollment.brightspaceId, quiz.id, cookie)
          if (!isDone) {
            const quizNameLower = quiz.name.toLowerCase().trim()
            isDone = [...gradedNames].some(gn =>
              gn === quizNameLower || gn.includes(quizNameLower) || quizNameLower.includes(gn)
            )
          }
          const isOverdue = daysUntil < 0 && !isDone

          if (daysUntil < -7 && isDone) continue

          let priority = 'medium'
          if (isOverdue || (daysUntil <= 2 && daysUntil >= 0)) priority = 'high'
          else if (daysUntil > 7) priority = 'low'

          await db.upsertSyncedTodo(userId, {
            course: appId,
            task: `Quiz: ${quiz.name}`,
            due: dueDate,
            done: isDone,
            priority,
            source: 'brightspace',
            sourceId: `bs-quiz-${enrollment.brightspaceId}-${quiz.id}`,
          })
          results.tasks++
        }
      } catch (e) {
        console.error(`[sync] Error syncing quizzes for ${appId}:`, e.message)
      }

      // 6b. Fetch discussion topics with due dates
      try {
        const discussions = await brightspace.fetchDiscussions(enrollment.brightspaceId, cookie)
        const now = new Date()

        for (const topic of discussions) {
          if (!topic.dueDate) continue

          const dueDate = new Date(topic.dueDate).toISOString().split('T')[0]
          const daysUntil = (new Date(dueDate) - now) / (1000 * 60 * 60 * 24)
          if (daysUntil > 60) continue

          const isDone = await brightspace.fetchMyDiscussionPosts(
            enrollment.brightspaceId, topic.forumId, topic.id, cookie
          )
          const isOverdue = daysUntil < 0 && !isDone

          if (daysUntil < -7 && isDone) continue

          let priority = 'medium'
          if (isOverdue || (daysUntil <= 2 && daysUntil >= 0)) priority = 'high'
          else if (daysUntil > 7) priority = 'low'

          await db.upsertSyncedTodo(userId, {
            course: appId,
            task: `Discussion: ${topic.name}`,
            due: dueDate,
            done: isDone,
            priority,
            source: 'brightspace',
            sourceId: `bs-discussion-${enrollment.brightspaceId}-${topic.id}`,
          })
          results.tasks++
        }
      } catch (e) {
        console.error(`[sync] Error syncing discussions for ${appId}:`, e.message)
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

    // 7b. Dedup: delete non-Brightspace tasks (manual + AI-extracted) that are
    // semantically the same as a Brightspace-synced task. The Brightspace one is
    // the source of truth because it can auto-complete on submission.
    try {
      const { rowCount: dedupCount } = await db.pool.query(`
        WITH toks AS (
          SELECT id, user_id, course_app_id, task, source,
                 (SELECT array_agg(w)
                    FROM unnest(regexp_split_to_array(regexp_replace(lower(task), '[^a-z0-9 ]', ' ', 'g'), '\\s+')) AS w
                    WHERE w NOT IN ('','the','and','of','a','an','in','on','to','for','by','with','at','from',
                                    'write','read','watch','start','work','submit','due','complete','finish',
                                    'assignment','homework','hw','paper','chapter','pages','page','pts',
                                    'mon','tue','wed','thu','fri','sat','sun')) AS sig
          FROM todos WHERE user_id = $1
        )
        DELETE FROM todos
        WHERE id IN (
          SELECT DISTINCT dup.id FROM toks dup
          JOIN toks bs
            ON dup.user_id = bs.user_id
           AND dup.course_app_id = bs.course_app_id
           AND dup.id <> bs.id
           AND dup.source <> 'brightspace'
           AND bs.source = 'brightspace'
           AND bs.sig IS NOT NULL
           AND array_length(bs.sig, 1) > 0
           AND bs.sig <@ dup.sig
        )
      `, [userId])
      if (dedupCount > 0) console.log(`[sync] Dedup removed ${dedupCount} duplicate task(s)`)
    } catch (e) {
      console.log('[sync] Dedup note:', e.message)
    }

    // Clean up old courses not in current semester
    try {
      const currentAppIds = activeCourses.map(enrollment => {
        const cleanName = enrollment.name
          .replace(/^(Spring|Fall|Summer)\s+\d{4}\s+/i, '')
          .replace(/\s*\([A-Z]{2,4}-[^)]+\)\s*$/, '')
          .trim()
        return generateAppId(cleanName, enrollment.code).appId
      })
      await db.deleteCoursesNotIn(userId, currentAppIds)
      console.log(`[sync] Cleaned up old courses, keeping ${currentAppIds.length} current: ${currentAppIds.join(', ')}`)
    } catch (e) {
      console.log('[sync] Course cleanup note:', e.message)
    }

    // Clean up old COMPLETED synced todos (keep overdue ones visible)
    try {
      await db.pool.query(
        `DELETE FROM todos WHERE user_id = $1 AND source = 'brightspace' AND done = true AND due < NOW() - INTERVAL '7 days'`,
        [userId]
      )
    } catch (e) {
      console.log('[sync] Cleanup note:', e.message)
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

// ─── Microsoft Graph Email Sync ───
// Fetches recent emails and matches them to courses by professor/subject
export async function syncEmails(userId, msAccessToken, courses) {
  const results = { synced: 0, errors: [] }

  try {
    // Fetch recent emails (last 30 days, max 100)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const graphUrl = `https://graph.microsoft.com/v1.0/me/messages?` +
      `$top=100&` +
      `$select=subject,from,receivedDateTime,bodyPreview,importance,isRead&` +
      `$orderby=receivedDateTime desc&` +
      `$filter=receivedDateTime ge ${thirtyDaysAgo}`

    const res = await fetch(graphUrl, {
      headers: { Authorization: `Bearer ${msAccessToken}` },
    })

    if (!res.ok) {
      const err = await res.text()
      if (res.status === 401) {
        results.errors.push('Microsoft token expired — re-login needed for Mail.Read scope')
      } else if (res.status === 403) {
        results.errors.push('Mail.Read permission not granted — re-login to grant email access')
      } else {
        results.errors.push(`Graph API error ${res.status}: ${err.slice(0, 200)}`)
      }
      return results
    }

    const data = await res.json()
    const messages = data.value || []

    if (messages.length === 0) return results

    // Build matchers from course data
    // Match emails to courses by: professor name, course name keywords, or .edu sender
    const courseMatchers = courses.map(c => ({
      id: c.id,
      name: c.name?.toLowerCase() || '',
      professor: c.professor?.toLowerCase() || '',
      // Extract last name from professor for matching
      profLastName: c.professor ? c.professor.split(/\s+/).pop()?.toLowerCase() : '',
    }))

    const emails = messages
      .filter(msg => {
        // Only keep emails from .edu addresses (professor/university emails)
        const senderEmail = msg.from?.emailAddress?.address || ''
        return senderEmail.endsWith('.edu')
      })
      .map(msg => {
        const senderName = msg.from?.emailAddress?.name || ''
        const senderEmail = msg.from?.emailAddress?.address || ''
        const subject = msg.subject || '(No subject)'
        const subjectLower = subject.toLowerCase()
        const senderLower = senderName.toLowerCase()

        // Try to match to a course
        let matchedCourse = null

        // 1. Match by professor name
        for (const cm of courseMatchers) {
          if (cm.professor && senderLower.includes(cm.professor)) {
            matchedCourse = cm.id
            break
          }
          if (cm.profLastName && cm.profLastName.length > 2 && senderLower.includes(cm.profLastName)) {
            matchedCourse = cm.id
            break
          }
        }

        // 2. Match by course name in subject
        if (!matchedCourse) {
          for (const cm of courseMatchers) {
            if (cm.name && cm.name.length > 3 && subjectLower.includes(cm.name)) {
              matchedCourse = cm.id
              break
            }
          }
        }

        return {
          course: matchedCourse,
          subject,
          from: senderName || senderEmail,
          fromEmail: senderEmail,
          date: msg.receivedDateTime ? new Date(msg.receivedDateTime).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          preview: (msg.bodyPreview || '').slice(0, 500),
          important: msg.importance === 'high',
        }
      })

    if (emails.length > 0) {
      await db.upsertEmails(userId, emails)
      results.synced = emails.length
      console.log(`[sync] Synced ${emails.length} emails from Microsoft Graph (${emails.filter(e => e.course).length} matched to courses)`)
    }

  } catch (e) {
    console.error('[sync] Email sync failed:', e.message)
    results.errors.push(e.message)
  }

  return results
}

export default { syncUserData, syncEmails }
