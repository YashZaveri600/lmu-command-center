#!/usr/bin/env node
/**
 * Brightspace Sync Script
 *
 * This script is called by Claude's scheduled tasks.
 * It uses the Brightspace D2L API to pull:
 * - Grades for all courses
 * - Announcements/updates
 * - Upcoming assignments
 *
 * The script expects to receive data via stdin (JSON) from the scheduled task
 * which uses the Chrome browser session to fetch from the API.
 *
 * Alternatively, it can be called with a JSON file path as argument.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')

// Course mapping - Brightspace IDs to our app IDs
const COURSE_MAP = {
  295178: 'managing',   // BCOR-3610-03 Managing People and Organizations
  295318: 'accounting', // BCOR-2120-11 Accounting Information for Decision Making
  296996: 'philosophy', // PHIL-1800-18/20 Philosophical Inquiry
  299689: 'marketing',  // BCOR-3510-02 Marketing and Business Strategy
}

const COURSE_NAMES = {
  managing: 'Managing People and Organizations',
  accounting: 'Accounting Information for Decision Making',
  philosophy: 'Philosophical Inquiry',
  marketing: 'Marketing and Business Strategy',
}

// Name-based category mapping for courses that don't use Brightspace categories
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

function inferCategory(courseName, gradeName, apiCategory) {
  // If Brightspace already gave a real category, use it
  if (apiCategory && apiCategory !== 'Uncategorized' && apiCategory !== 'Numeric') {
    return apiCategory
  }
  // Try name-based matching
  const rules = NAME_CATEGORY_RULES[courseName]
  if (rules) {
    for (const rule of rules) {
      if (rule.match.test(gradeName)) return rule.category
    }
  }
  return apiCategory || 'Uncategorized'
}

function readJSON(filename) {
  const filepath = path.join(DATA_DIR, filename)
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
  } catch {
    return null
  }
}

function writeJSON(filename, data) {
  const filepath = path.join(DATA_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
  console.log(`Updated ${filename}`)
}

function updateGrades(apiGrades, apiCategories) {
  const existing = readJSON('grades.json') || { courses: {} }

  for (const [bsId, appId] of Object.entries(COURSE_MAP)) {
    const courseGrades = apiGrades[appId]
    const courseCategories = apiCategories[appId]

    if (!courseGrades) continue

    // Build weights from categories if available
    const weights = {}
    if (courseCategories && Array.isArray(courseCategories) && courseCategories.length > 0) {
      courseCategories.forEach(cat => {
        if (cat.name && cat.weight > 0) {
          weights[cat.name] = { weight: cat.weight / 100 }
          if (cat.maxPoints) weights[cat.name].points = cat.maxPoints
        }
      })
    }

    // Use existing weights if API didn't return categories
    const finalWeights = Object.keys(weights).length > 0
      ? weights
      : (existing.courses[appId]?.weights || {})

    // Map grades with smart category inference
    const grades = courseGrades.map((g, idx) => ({
      id: `grade-${appId}-bs-${g.id || idx}`,
      category: inferCategory(appId, g.name, g.category),
      name: g.name,
      score: g.points ?? 0,
      maxScore: g.maxPoints ?? 100,
      date: g.date || new Date().toISOString().split('T')[0],
    })).filter(g => g.maxScore > 0 && g.score !== null)

    existing.courses[appId] = {
      weights: finalWeights,
      grades,
    }
  }

  writeJSON('grades.json', existing)
  return existing
}

function updateAnnouncements(apiNews) {
  const updates = []
  let id = 1

  for (const [appId, newsItems] of Object.entries(apiNews)) {
    if (!Array.isArray(newsItems)) continue

    newsItems.forEach(item => {
      updates.push({
        id: id++,
        course: appId,
        title: item.title,
        body: item.body || '',
        date: item.date ? new Date(item.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        type: 'announcement',
        read: false,
      })
    })
  }

  // Sort by date descending
  updates.sort((a, b) => new Date(b.date) - new Date(a.date))
  writeJSON('brightspace_updates.json', updates)
  return updates
}

function updateTodos(apiAssignments) {
  const existing = readJSON('weekly_todos.json') || []
  const newTodos = []
  let maxId = existing.reduce((max, t) => Math.max(max, t.id || 0), 0)

  for (const [appId, assignments] of Object.entries(apiAssignments)) {
    if (!Array.isArray(assignments)) continue

    assignments.forEach(a => {
      // Check if we already have this todo
      const alreadyExists = existing.some(t =>
        t.title === a.name && t.course === appId
      )
      if (alreadyExists) return

      if (a.dueDate) {
        newTodos.push({
          id: ++maxId,
          title: a.name,
          course: appId,
          due: new Date(a.dueDate).toISOString().split('T')[0],
          done: a.completed || false,
          priority: 'medium',
        })
      }
    })
  }

  const combined = [...existing, ...newTodos]
  writeJSON('weekly_todos.json', combined)
  return combined
}

// Main: read sync data from stdin or file argument
async function main() {
  let input = ''

  const filePath = process.argv[2]
  if (filePath) {
    input = fs.readFileSync(filePath, 'utf-8')
  } else {
    // Read from stdin
    input = await new Promise((resolve) => {
      let data = ''
      process.stdin.on('data', chunk => data += chunk)
      process.stdin.on('end', () => resolve(data))
      // Timeout after 5 seconds if no input
      setTimeout(() => resolve(data), 5000)
    })
  }

  if (!input.trim()) {
    console.error('No input data provided. Pass JSON via stdin or file path argument.')
    process.exit(1)
  }

  try {
    const data = JSON.parse(input)

    if (data.grades) {
      console.log('Syncing grades...')
      updateGrades(data.grades, data.categories || {})
    }

    if (data.announcements) {
      console.log('Syncing announcements...')
      updateAnnouncements(data.announcements)
    }

    if (data.assignments) {
      console.log('Syncing assignments/todos...')
      updateTodos(data.assignments)
    }

    console.log('Brightspace sync complete!')

    // Auto-push to GitHub if in a git repo
    const { execSync } = await import('child_process')
    try {
      const projectDir = path.join(__dirname, '..')
      execSync('git add data/', { cwd: projectDir, stdio: 'pipe' })
      const status = execSync('git status --porcelain data/', { cwd: projectDir, encoding: 'utf-8' })
      if (status.trim()) {
        const date = new Date().toISOString().split('T')[0]
        execSync(`git commit -m "auto: sync grades from Brightspace ${date}"`, { cwd: projectDir, stdio: 'pipe' })
        execSync('git push', { cwd: projectDir, stdio: 'pipe' })
        console.log('Pushed updated data to GitHub → Railway will redeploy')
      } else {
        console.log('No changes to push')
      }
    } catch (gitErr) {
      console.log('Git push skipped:', gitErr.message)
    }

  } catch (e) {
    console.error('Failed to parse input:', e.message)
    process.exit(1)
  }
}

main()
