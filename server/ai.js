/**
 * AI-powered task extraction from announcements and emails
 *
 * Uses Claude API to analyze text and extract:
 * - Assignment names and due dates
 * - Whether content is an announcement or task
 * - Priority level
 */

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

/**
 * Analyze announcements/emails to extract tasks
 * @param {Array} items - Array of { title, body, course, date, source }
 * @returns {Array} Extracted tasks: { task, course, due, priority, source, sourceId }
 */
export async function extractTasks(items) {
  if (!ANTHROPIC_API_KEY || items.length === 0) return []

  // Batch items into a single prompt for efficiency
  const itemDescriptions = items.map((item, i) =>
    `[${i}] Course: ${item.course}\nTitle: ${item.title}\nDate: ${item.date}\nBody: ${(item.body || '').slice(0, 500)}`
  ).join('\n---\n')

  const today = new Date().toISOString().split('T')[0]

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are analyzing university course announcements and emails for a student. Today is ${today}.

Extract ANY actionable tasks, assignments, or deadlines from the following items. Only extract items that require the student to DO something (submit, study, prepare, attend, etc). Do NOT extract pure announcements or informational posts.

${itemDescriptions}

Respond with a JSON array only. Each task object:
{"index": <source item index>, "task": "<short task name>", "due": "<YYYY-MM-DD or null>", "priority": "high|medium|low"}

Rules:
- "high" priority: exams, finals, midterms, papers, projects due within 3 days
- "medium" priority: homework, assignments, quizzes due within 1 week
- "low" priority: readings, optional tasks, things due in 2+ weeks
- If no due date is mentioned, infer from context or use null
- If an item is just an announcement with no action needed, skip it
- Return [] if no tasks found

Respond ONLY with the JSON array, no markdown or explanation.`
        }],
      }),
    })

    if (!res.ok) {
      console.error(`[ai] Claude API error: ${res.status} ${res.statusText}`)
      return []
    }

    const data = await res.json()
    const text = data.content?.[0]?.text || '[]'

    // Parse the JSON response
    const extracted = JSON.parse(text.replace(/```json\n?|\n?```/g, '').trim())

    return extracted.map(task => {
      const sourceItem = items[task.index]
      if (!sourceItem) return null
      return {
        task: task.task,
        course: sourceItem.course,
        due: task.due,
        priority: task.priority || 'medium',
        source: sourceItem.source || 'ai-announcement',
        sourceId: `ai-${sourceItem.source}-${sourceItem.course}-${sourceItem.title?.slice(0, 50)?.replace(/[^a-zA-Z0-9]/g, '-')}`,
      }
    }).filter(Boolean)

  } catch (e) {
    console.error('[ai] Task extraction failed:', e.message)
    return []
  }
}

/**
 * Generate a personalized daily briefing for a student
 * Uses their grades, todos, courses, and announcements to create an actionable summary
 */
export async function generateDailyBriefing({ courses, grades, todos, announcements }) {
  if (!ANTHROPIC_API_KEY) return null

  const today = new Date().toISOString().split('T')[0]
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  // Build context from student data
  const courseList = (courses || []).map(c => `${c.shortCode} - ${c.name}`).join(', ')

  const pendingTasks = (todos || []).filter(t => !t.done).map(t => {
    const overdue = t.due && new Date(t.due + 'T23:59:59') < new Date()
    return `- [${t.course}] ${t.task}${t.due ? ` (due ${t.due})` : ''}${overdue ? ' ⚠️ OVERDUE' : ''} [${t.priority}]`
  }).join('\n')

  // Compute weighted GPA per course (same logic as frontend)
  const letterGrade = (pct) => {
    if (pct >= 93) return 'A'; if (pct >= 90) return 'A-'; if (pct >= 87) return 'B+'
    if (pct >= 83) return 'B'; if (pct >= 80) return 'B-'; return 'C or below'
  }
  const gpaMap = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7 }

  const gradesSummary = (grades || []).map(g => {
    if (!g.grades || g.grades.length === 0) return null
    const weights = g.weights || {}
    const catScores = {}, catCounts = {}
    g.grades.forEach(gr => {
      if (!catScores[gr.category]) { catScores[gr.category] = 0; catCounts[gr.category] = 0 }
      catScores[gr.category] += (gr.score / gr.maxScore) * 100
      catCounts[gr.category] += 1
    })
    let totalW = 0, totalWt = 0
    Object.entries(catScores).forEach(([cat, total]) => {
      const avg = total / catCounts[cat]
      const w = weights[cat]
      const wt = typeof w === 'number' ? w * 100 : (w?.weight != null ? w.weight * 100 : 0)
      if (wt > 0) { totalW += avg * (wt / 100); totalWt += wt }
    })
    const pct = totalWt > 0 ? (totalW / totalWt) * 100 : null
    if (!pct) return null
    const letter = letterGrade(pct)
    return `${g.course}: ${letter} (${pct.toFixed(1)}%, GPA ${(gpaMap[letter] || 2.0).toFixed(1)})`
  }).filter(Boolean).join('\n')

  const recentAnnouncements = (announcements || [])
    .filter(a => a.type === 'announcement')
    .slice(0, 5)
    .map(a => `- [${a.course}] ${a.title}`)
    .join('\n')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `You are EduSync AI, a friendly university assistant. Generate a brief daily briefing for a student. Today is ${dayName}, ${today}.

Courses: ${courseList}

Pending Tasks:
${pendingTasks || 'None!'}

Grade Averages:
${gradesSummary || 'No grades yet'}

Recent Announcements:
${recentAnnouncements || 'None'}

Write a concise, motivating daily briefing (3-5 short paragraphs max). Include:
1. A quick greeting with what day it is
2. Most urgent items (overdue or due today/tomorrow) — be specific
3. A quick note on grades if any are trending up or down
4. One motivating line to end

Keep it conversational and brief. Use the student's actual data — don't make anything up. No markdown headers, just plain text paragraphs.`
        }],
      }),
    })

    if (!res.ok) {
      console.error(`[ai] Briefing API error: ${res.status}`)
      return null
    }

    const data = await res.json()
    return data.content?.[0]?.text || null
  } catch (e) {
    console.error('[ai] Briefing generation failed:', e.message)
    return null
  }
}

/**
 * Calculate what score is needed on remaining work to achieve a target grade
 */
export async function whatDoINeed({ courseName, currentGrades, weights, targetGrade }) {
  if (!ANTHROPIC_API_KEY) return null

  try {
    const gradesInfo = currentGrades.map(g =>
      `${g.name} (${g.category}): ${g.score}/${g.maxScore}`
    ).join('\n')

    const weightsInfo = Object.entries(weights || {}).map(([cat, w]) =>
      `${cat}: ${(w.weight * 100).toFixed(0)}%`
    ).join(', ')

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages: [{
          role: 'user',
          content: `You are a grade calculator for ${courseName}.

Category weights: ${weightsInfo || 'equal weight'}

Current grades:
${gradesInfo}

Target grade: ${targetGrade}%

Calculate what average score the student needs on remaining assignments to achieve ${targetGrade}%. Be specific about which categories still need work. Give a brief, clear answer — 2-3 sentences max. If the target is already achieved, say so.`
        }],
      }),
    })

    if (!res.ok) return null
    const data = await res.json()
    return data.content?.[0]?.text || null
  } catch (e) {
    console.error('[ai] Grade calc failed:', e.message)
    return null
  }
}

export default { extractTasks, generateDailyBriefing, whatDoINeed }
