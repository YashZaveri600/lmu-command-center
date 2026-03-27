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

export default { extractTasks }
