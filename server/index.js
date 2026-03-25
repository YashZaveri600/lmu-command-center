import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', 'data')
const PORT = process.env.API_PORT || 3001

const app = express()
app.use(cors())
app.use(express.json())

// --- SSE for live updates ---
const clients = []

function broadcast(event, data) {
  clients.forEach(res => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  })
}

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })
  res.write('data: connected\n\n')
  clients.push(res)
  req.on('close', () => {
    const i = clients.indexOf(res)
    if (i !== -1) clients.splice(i, 1)
  })
})

// --- Helper to read/write JSON ---
function readJSON(filename) {
  const filepath = path.join(DATA_DIR, filename)
  if (!fs.existsSync(filepath)) return null
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
}

function writeJSON(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2))
}

// --- GET endpoints ---
const dataFiles = {
  updates: 'brightspace_updates.json',
  todos: 'weekly_todos.json',
  emails: 'professor_emails.json',
  schedule: 'schedule.json',
  courses: 'courses.json',
  automations: 'automations.json',
  grades: 'grades.json',
  notes: 'notes.json',
  'study-sessions': 'study_sessions.json',
  semester: 'semester.json',
}

for (const [route, file] of Object.entries(dataFiles)) {
  app.get(`/api/${route}`, (req, res) => {
    const data = readJSON(file)
    if (data === null) return res.status(404).json({ error: 'Not found' })
    res.json(data)
  })
}

// --- Todo CRUD ---
app.patch('/api/todos/:id', (req, res) => {
  const todos = readJSON('weekly_todos.json')
  if (!todos) return res.status(404).json({ error: 'Not found' })
  const todo = todos.find(t => t.id === req.params.id)
  if (!todo) return res.status(404).json({ error: 'Todo not found' })
  Object.assign(todo, req.body)
  writeJSON('weekly_todos.json', todos)
  broadcast('todos', todos)
  res.json(todo)
})

app.post('/api/todos', (req, res) => {
  const todos = readJSON('weekly_todos.json') || []
  const newTodo = {
    id: `todo-${Date.now()}`,
    course: req.body.course || 'managing',
    task: req.body.task,
    due: req.body.due,
    done: false,
    priority: req.body.priority || 'medium',
  }
  todos.push(newTodo)
  writeJSON('weekly_todos.json', todos)
  broadcast('todos', todos)
  res.status(201).json(newTodo)
})

app.delete('/api/todos/:id', (req, res) => {
  let todos = readJSON('weekly_todos.json') || []
  todos = todos.filter(t => t.id !== req.params.id)
  writeJSON('weekly_todos.json', todos)
  broadcast('todos', todos)
  res.json({ ok: true })
})

// --- Grades CRUD ---
app.post('/api/grades', (req, res) => {
  const data = readJSON('grades.json') || { courses: {} }
  const { courseId, category, score, maxScore, name } = req.body
  if (!data.courses[courseId]) return res.status(404).json({ error: 'Course not found' })
  data.courses[courseId].grades.push({
    id: `grade-${Date.now()}`,
    category,
    name: name || category,
    score,
    maxScore: maxScore || 100,
    date: new Date().toISOString().split('T')[0],
  })
  writeJSON('grades.json', data)
  broadcast('grades', data)
  res.status(201).json(data)
})

app.delete('/api/grades/:courseId/:gradeId', (req, res) => {
  const data = readJSON('grades.json')
  if (!data?.courses[req.params.courseId]) return res.status(404).json({ error: 'Not found' })
  data.courses[req.params.courseId].grades = data.courses[req.params.courseId].grades.filter(
    g => g.id !== req.params.gradeId
  )
  writeJSON('grades.json', data)
  broadcast('grades', data)
  res.json({ ok: true })
})

app.post('/api/webhook/grades', (req, res) => {
  const data = req.body
  if (!data || !data.courses) return res.status(400).json({ error: 'Expected grades object with courses' })
  writeJSON('grades.json', data)
  broadcast('grades', data)
  res.json({ ok: true })
})

// --- Notes CRUD ---
app.post('/api/notes', (req, res) => {
  const notes = readJSON('notes.json') || []
  const note = {
    id: `note-${Date.now()}`,
    course: req.body.course,
    text: req.body.text,
    date: new Date().toISOString(),
  }
  notes.unshift(note)
  writeJSON('notes.json', notes)
  broadcast('notes', notes)
  res.status(201).json(note)
})

app.delete('/api/notes/:id', (req, res) => {
  let notes = readJSON('notes.json') || []
  notes = notes.filter(n => n.id !== req.params.id)
  writeJSON('notes.json', notes)
  broadcast('notes', notes)
  res.json({ ok: true })
})

// --- Study sessions ---
app.post('/api/study-sessions', (req, res) => {
  const data = readJSON('study_sessions.json') || { sessions: [], streaks: { current: 0, best: 0, lastCompleted: null } }
  const session = {
    id: `study-${Date.now()}`,
    course: req.body.course,
    duration: req.body.duration,
    date: new Date().toISOString(),
  }
  data.sessions.push(session)

  // Update streak
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (data.streaks.lastCompleted === yesterday) {
    data.streaks.current += 1
  } else if (data.streaks.lastCompleted !== today) {
    data.streaks.current = 1
  }
  data.streaks.lastCompleted = today
  if (data.streaks.current > data.streaks.best) data.streaks.best = data.streaks.current

  writeJSON('study_sessions.json', data)
  broadcast('study-sessions', data)
  res.status(201).json(data)
})

// --- Webhook endpoints for Cowork automations ---
app.post('/api/webhook/updates', (req, res) => {
  const updates = req.body
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'Expected an array' })
  writeJSON('brightspace_updates.json', updates)
  broadcast('updates', updates)
  res.json({ ok: true, count: updates.length })
})

app.post('/api/webhook/emails', (req, res) => {
  const emails = req.body
  if (!Array.isArray(emails)) return res.status(400).json({ error: 'Expected an array' })
  writeJSON('professor_emails.json', emails)
  broadcast('emails', emails)
  res.json({ ok: true, count: emails.length })
})

app.post('/api/webhook/todos', (req, res) => {
  const todos = req.body
  if (!Array.isArray(todos)) return res.status(400).json({ error: 'Expected an array' })
  writeJSON('weekly_todos.json', todos)
  broadcast('todos', todos)
  res.json({ ok: true, count: todos.length })
})

app.post('/api/webhook/automations', (req, res) => {
  const automations = req.body
  if (!Array.isArray(automations)) return res.status(400).json({ error: 'Expected an array' })
  writeJSON('automations.json', automations)
  broadcast('automations', automations)
  res.json({ ok: true, count: automations.length })
})

// --- Search endpoint ---
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase()
  if (!q) return res.json({ updates: [], todos: [], emails: [] })

  const updates = (readJSON('brightspace_updates.json') || []).filter(u =>
    u.title.toLowerCase().includes(q) || u.detail.toLowerCase().includes(q)
  )
  const todos = (readJSON('weekly_todos.json') || []).filter(t =>
    t.task.toLowerCase().includes(q)
  )
  const emails = (readJSON('professor_emails.json') || []).filter(e =>
    e.subject.toLowerCase().includes(q) || e.preview.toLowerCase().includes(q)
  )

  res.json({ updates, todos, emails })
})

// --- Export weekly summary ---
app.get('/api/export-summary', (req, res) => {
  const updates = readJSON('brightspace_updates.json') || []
  const todos = readJSON('weekly_todos.json') || []
  const courses = readJSON('courses.json') || []

  const getCourse = (id) => courses.find(c => c.id === id)?.name || id
  const today = new Date()
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()))
  const weekEndStr = weekEnd.toISOString().split('T')[0]
  const todayStr = today.toISOString().split('T')[0]

  const urgent = updates.filter(u => u.urgency === 'urgent')
  const upcoming = updates.filter(u => u.type === 'assignment' && u.date <= weekEndStr && u.date >= todayStr)
  const pendingTodos = todos.filter(t => !t.done)

  let summary = `LMU COMMAND CENTER — WEEKLY SUMMARY\n`
  summary += `${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}\n`
  summary += `${'='.repeat(50)}\n\n`

  if (urgent.length > 0) {
    summary += `URGENT:\n`
    urgent.forEach(u => { summary += `  [!] ${getCourse(u.course)}: ${u.title} — due ${u.date}\n` })
    summary += `\n`
  }

  summary += `THIS WEEK'S DEADLINES:\n`
  upcoming.forEach(u => { summary += `  - ${getCourse(u.course)}: ${u.title} — ${u.date}\n` })
  summary += `\n`

  summary += `PENDING TASKS (${pendingTodos.length}):\n`
  pendingTodos.forEach(t => { summary += `  [ ] ${getCourse(t.course)}: ${t.task} — due ${t.due}\n` })

  res.type('text/plain').send(summary)
})

// --- Sync files endpoint ---
app.post('/api/sync-files', async (req, res) => {
  try {
    const { execSync } = await import('child_process')
    execSync('node scripts/sync-files.js', { cwd: path.join(__dirname, '..') })
    const courses = readJSON('courses.json')
    broadcast('courses', courses)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// --- File watcher: watch data/ for changes from Cowork automations ---
async function startWatcher() {
  try {
    const chokidar = await import('chokidar')
    const watcher = chokidar.watch(DATA_DIR, { ignoreInitial: true })
    watcher.on('change', (filepath) => {
      const filename = path.basename(filepath)
      const route = Object.entries(dataFiles).find(([, f]) => f === filename)?.[0]
      if (route) {
        try {
          const data = readJSON(filename)
          broadcast(route, data)
          console.log(`[watcher] ${filename} changed, broadcast to ${clients.length} client(s)`)
        } catch {}
      }
    })
    console.log(`[watcher] Watching ${DATA_DIR} for changes`)
  } catch {
    console.log('[watcher] chokidar not available, file watching disabled')
  }
}

// --- Serve built frontend in production ---
const distPath = path.join(__dirname, '..', 'dist')
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath))
  app.get('{*path}', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

const port = process.env.PORT || PORT
app.listen(port, () => {
  console.log(`\n  Server running at http://localhost:${port}`)
  startWatcher()
})
