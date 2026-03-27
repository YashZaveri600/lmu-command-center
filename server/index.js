import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from './db/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.API_PORT || 3001

// Until Phase 2 (Microsoft SSO), hardcode user ID 1 (Yash)
const USER_ID = 1

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

// --- GET endpoints (all backed by PostgreSQL) ---
app.get('/api/courses', async (req, res) => {
  try { res.json(await db.getCourses(USER_ID)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/grades', async (req, res) => {
  try { res.json(await db.getGrades(USER_ID)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/todos', async (req, res) => {
  try { res.json(await db.getTodos(USER_ID)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/updates', async (req, res) => {
  try { res.json(await db.getUpdates(USER_ID)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/emails', async (req, res) => {
  try { res.json(await db.getEmails(USER_ID)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/notes', async (req, res) => {
  try { res.json(await db.getNotes(USER_ID)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/study-sessions', async (req, res) => {
  try { res.json(await db.getStudySessions(USER_ID)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/schedule', async (req, res) => {
  try { res.json(await db.getSchedule(USER_ID)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/semester', async (req, res) => {
  try {
    const data = await db.getSemester(USER_ID)
    if (!data) return res.status(404).json({ error: 'Not found' })
    res.json(data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/automations', async (req, res) => {
  try { res.json(await db.getAutomations(USER_ID)) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Todo CRUD ---
app.post('/api/todos', async (req, res) => {
  try {
    const newTodo = await db.addTodo(USER_ID, req.body)
    const todos = await db.getTodos(USER_ID)
    broadcast('todos', todos)
    res.status(201).json(newTodo)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/todos/:id', async (req, res) => {
  try {
    await db.updateTodo(USER_ID, req.params.id, req.body)
    const todos = await db.getTodos(USER_ID)
    broadcast('todos', todos)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/todos/:id', async (req, res) => {
  try {
    await db.deleteTodo(USER_ID, req.params.id)
    const todos = await db.getTodos(USER_ID)
    broadcast('todos', todos)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Grades CRUD ---
app.post('/api/grades', async (req, res) => {
  try {
    const { courseId, category, score, maxScore, name } = req.body
    await db.addGrade(USER_ID, courseId, {
      category,
      name: name || category,
      score,
      maxScore: maxScore || 100,
      date: new Date().toISOString().split('T')[0],
    })
    const data = await db.getGrades(USER_ID)
    broadcast('grades', data)
    res.status(201).json(data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/grades/:courseId/:gradeId', async (req, res) => {
  try {
    await db.deleteGrade(USER_ID, req.params.courseId, req.params.gradeId)
    const data = await db.getGrades(USER_ID)
    broadcast('grades', data)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Notes CRUD ---
app.post('/api/notes', async (req, res) => {
  try {
    const note = await db.addNote(USER_ID, req.body)
    const notes = await db.getNotes(USER_ID)
    broadcast('notes', notes)
    res.status(201).json(note)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/notes/:id', async (req, res) => {
  try {
    await db.deleteNote(USER_ID, req.params.id)
    const notes = await db.getNotes(USER_ID)
    broadcast('notes', notes)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Study sessions ---
app.post('/api/study-sessions', async (req, res) => {
  try {
    const data = await db.addStudySession(USER_ID, req.body)
    broadcast('study-sessions', data)
    res.status(201).json(data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Webhook endpoints (still supported for backward compat with sync script) ---
app.post('/api/webhook/grades', async (req, res) => {
  try {
    const data = req.body
    if (!data?.courses) return res.status(400).json({ error: 'Expected grades object with courses' })
    for (const [courseId, courseData] of Object.entries(data.courses)) {
      await db.upsertGrades(USER_ID, courseId, courseData)
    }
    const grades = await db.getGrades(USER_ID)
    broadcast('grades', grades)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/webhook/updates', async (req, res) => {
  try {
    const updates = req.body
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Expected an array' })
    await db.upsertUpdates(USER_ID, updates)
    const data = await db.getUpdates(USER_ID)
    broadcast('updates', data)
    res.json({ ok: true, count: updates.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/webhook/emails', async (req, res) => {
  try {
    const emails = req.body
    if (!Array.isArray(emails)) return res.status(400).json({ error: 'Expected an array' })
    await db.upsertEmails(USER_ID, emails)
    const data = await db.getEmails(USER_ID)
    broadcast('emails', data)
    res.json({ ok: true, count: emails.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/webhook/todos', async (req, res) => {
  try {
    const todos = req.body
    if (!Array.isArray(todos)) return res.status(400).json({ error: 'Expected an array' })
    // Clear and re-insert
    for (const t of todos) {
      await db.addTodo(USER_ID, { course: t.course, task: t.task || t.title, due: t.due, done: t.done, priority: t.priority })
    }
    const data = await db.getTodos(USER_ID)
    broadcast('todos', data)
    res.json({ ok: true, count: todos.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/webhook/automations', async (req, res) => {
  try {
    const automations = req.body
    if (!Array.isArray(automations)) return res.status(400).json({ error: 'Expected an array' })
    await db.upsertAutomations(USER_ID, automations)
    const data = await db.getAutomations(USER_ID)
    broadcast('automations', data)
    res.json({ ok: true, count: automations.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Search endpoint ---
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q || ''
    if (!query) return res.json({ updates: [], todos: [], emails: [] })
    res.json(await db.search(USER_ID, query))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Export weekly summary ---
app.get('/api/export-summary', async (req, res) => {
  try {
    const updates = await db.getUpdates(USER_ID)
    const todos = await db.getTodos(USER_ID)
    const courses = await db.getCourses(USER_ID)

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
  } catch (e) { res.status(500).json({ error: e.message }) }
})

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
})
