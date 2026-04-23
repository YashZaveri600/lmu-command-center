import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import session from 'express-session'
import connectPgSimple from 'connect-pg-simple'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import db from './db/index.js'
import brightspace from './brightspace.js'
import { syncUserData, syncEmails } from './sync.js'
import { generateDailyBriefing, whatDoINeed } from './ai.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.API_PORT || 3001
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`

const app = express()
app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

// Trust Railway's proxy so secure cookies work
app.set('trust proxy', 1)

// --- Session middleware (backed by PostgreSQL) ---
const PgSession = connectPgSimple(session)
app.use(session({
  store: new PgSession({ pool: db.pool, tableName: 'session' }),
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production' || APP_URL.startsWith('https'),
    httpOnly: true,
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    sameSite: 'lax',
  },
}))

// --- Microsoft OAuth2 config ---
const MS_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID
const MS_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET
const MS_REDIRECT_URI = `${APP_URL}/auth/microsoft/callback`
const MS_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const MS_SCOPES = 'openid profile email User.Read'
const MS_SCOPES_WITH_EMAIL = 'openid profile email User.Read Mail.Read'

// --- Microsoft token refresh ---
// Access tokens expire after ~1 hour. Use the refresh token to get a new one.
export async function refreshMicrosoftToken(userId) {
  const tokens = await db.getTokens(userId, 'microsoft')
  if (!tokens) return null

  // If token hasn't expired yet, return it
  if (tokens.expiresAt && new Date(tokens.expiresAt) > new Date()) {
    return tokens.accessToken
  }

  // No refresh token = can't refresh, user needs to re-login
  if (!tokens.refreshToken) return null

  try {
    const res = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        refresh_token: tokens.refreshToken,
        grant_type: 'refresh_token',
        scope: MS_SCOPES,
      }),
    })
    const data = await res.json()
    if (data.error) {
      console.error('[auth] Token refresh failed:', data.error_description)
      return null
    }

    // Save updated tokens
    await db.saveTokens(userId, 'microsoft', {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      scopes: MS_SCOPES,
    })

    return data.access_token
  } catch (e) {
    console.error('[auth] Token refresh error:', e.message)
    return null
  }
}

// --- Auth routes ---

// Start Microsoft login
app.get('/auth/microsoft', (req, res) => {
  // If ?email=1, request Mail.Read scope (opt-in for email sync)
  const scopes = req.query.email === '1' ? MS_SCOPES_WITH_EMAIL : MS_SCOPES
  const state = req.query.email === '1' ? 'email' : ''
  const params = new URLSearchParams({
    client_id: MS_CLIENT_ID,
    response_type: 'code',
    redirect_uri: MS_REDIRECT_URI,
    scope: scopes,
    response_mode: 'query',
    prompt: req.query.email === '1' ? 'consent' : 'select_account',
    ...(state && { state }),
  })
  res.redirect(`${MS_AUTH_URL}?${params}`)
})

// Microsoft callback — exchange code for tokens, create/find user
app.get('/auth/microsoft/callback', async (req, res) => {
  const { code, error, state } = req.query
  const requestedEmail = state === 'email'
  const scopes = requestedEmail ? MS_SCOPES_WITH_EMAIL : MS_SCOPES

  if (error || !code) {
    console.error('[auth] Microsoft login error:', error || 'no code')
    return res.redirect('/?auth_error=1')
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch(MS_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        code,
        redirect_uri: MS_REDIRECT_URI,
        grant_type: 'authorization_code',
        scope: scopes,
      }),
    })

    const tokens = await tokenRes.json()
    if (tokens.error) {
      console.error('[auth] Token exchange error:', tokens.error_description)
      return res.redirect('/?auth_error=1')
    }

    // Get user profile from Microsoft Graph
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })
    const profile = await profileRes.json()

    // Find or create user in our database
    const userId = await db.findOrCreateUser(
      profile.id,
      profile.mail || profile.userPrincipalName,
      profile.displayName
    )

    // Save Microsoft tokens for later use (email sync, etc.)
    await db.saveTokens(userId, 'microsoft', {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scopes: scopes,
    })

    // Set session
    req.session.userId = userId
    req.session.save(() => {
      res.redirect(requestedEmail ? '/?email_granted=1' : '/')
    })
  } catch (e) {
    console.error('[auth] Callback error:', e)
    res.redirect('/?auth_error=1')
  }
})

// Check current auth status
app.get('/api/auth/me', async (req, res) => {
  if (!req.session.userId) {
    return res.json({ authenticated: false })
  }
  const user = await db.getUser(req.session.userId)
  if (!user) {
    return res.json({ authenticated: false })
  }
  // Include email scope status
  const msTokens = await db.getTokens(req.session.userId, 'microsoft')
  const emailEnabled = msTokens?.scopes?.includes('Mail.Read') || false
  res.json({ authenticated: true, user, emailEnabled })
})

// Logout
app.post('/auth/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true })
  })
})

// --- Auth middleware — protect all /api routes (except /api/auth/*) ---
function requireAuth(req, res, next) {
  if (req.path.startsWith('/api/auth/')) return next()
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  req.userId = req.session.userId
  next()
}

app.use('/api', requireAuth)

// Helper to get userId from request (uses session now instead of hardcoded)
const getUserId = (req) => req.userId || req.session.userId

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
  try { res.json(await db.getCourses(getUserId(req))) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/grades', async (req, res) => {
  try { res.json(await db.getGrades(getUserId(req))) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/todos', async (req, res) => {
  try { res.json(await db.getTodos(getUserId(req))) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// Quick submission check — checks pending Brightspace tasks for completion
app.post('/api/todos/check-submissions', async (req, res) => {
  try {
    const uid = getUserId(req)
    const tokens = await db.getTokens(uid, 'brightspace')
    if (!tokens?.access_token) return res.json({ ok: true, checked: 0, updated: 0 })

    const cookie = tokens.access_token

    // Get ALL pending brightspace tasks (with or without source_id)
    const { rows: pendingTasks } = await db.pool.query(
      `SELECT id, source_id, task, course_app_id FROM todos WHERE user_id = $1 AND source = 'brightspace' AND done = false`,
      [uid]
    )
    if (pendingTasks.length === 0) return res.json({ ok: true, checked: 0, updated: 0 })

    // For tasks WITH source_id, check directly
    // For tasks WITHOUT source_id, we need to look up assignments by course
    let updated = 0
    const courseAssignmentCache = {} // courseAppId -> assignments list

    // Pre-fetch all grade names per course for fallback matching.
    // If Brightspace dropbox submission detection misses, a graded item with a
    // matching name means the assignment is effectively done.
    const gradeNamesByCourse = {}
    {
      const { rows: gradeRows } = await db.pool.query(
        `SELECT course_app_id, LOWER(TRIM(name)) AS name FROM grades WHERE user_id = $1`,
        [uid]
      )
      for (const row of gradeRows) {
        if (!gradeNamesByCourse[row.course_app_id]) gradeNamesByCourse[row.course_app_id] = new Set()
        gradeNamesByCourse[row.course_app_id].add(row.name)
      }
    }

    function matchesGradedItem(taskName, courseAppId) {
      const set = gradeNamesByCourse[courseAppId]
      if (!set) return false
      const n = (taskName || '').replace(/^(Quiz: |Discussion: )/, '').trim().toLowerCase()
      if (!n) return false
      if (set.has(n)) return true
      for (const g of set) {
        if (g === n || g.includes(n) || n.includes(g)) return true
      }
      return false
    }

    for (const task of pendingTasks) {
      let done = false

      if (task.source_id) {
        const parts = task.source_id.split('-')
        if (parts[1] === 'assignment' && parts.length >= 4) {
          done = await brightspace.fetchMySubmissions(parts[2], parts.slice(3).join('-'), cookie)
        } else if (parts[1] === 'quiz' && parts.length >= 4) {
          done = await brightspace.fetchQuizAttempts(parts[2], parts.slice(3).join('-'), cookie)
        } else if (parts[1] === 'discussion' && parts.length >= 4) {
          try {
            const discussions = await brightspace.fetchDiscussions(parts[2], cookie)
            const topic = discussions.find(d => String(d.id) === parts.slice(3).join('-'))
            if (topic) done = await brightspace.fetchMyDiscussionPosts(parts[2], topic.forumId, topic.id, cookie)
          } catch (e) { /* skip */ }
        }
        // Fallback: if Brightspace says "not submitted" but there's a grade
        // with a matching name, treat as done.
        if (!done && matchesGradedItem(task.task, task.course_app_id)) {
          done = true
        }
      } else {
        // No source_id — look up by matching task name to Brightspace assignments
        try {
          // Get the brightspace course ID from user's courses
          const { rows: courseRows } = await db.pool.query(
            `SELECT brightspace_id FROM courses WHERE user_id = $1 AND app_id = $2`,
            [uid, task.course_app_id]
          )
          if (courseRows.length > 0 && courseRows[0].brightspace_id) {
            const bsCourseId = courseRows[0].brightspace_id
            // Cache assignments per course
            if (!courseAssignmentCache[bsCourseId]) {
              const assignments = await brightspace.fetchAssignments(bsCourseId, cookie)
              courseAssignmentCache[bsCourseId] = assignments
            }
            // Find matching assignment by name
            const taskName = task.task.replace(/^(Quiz: |Discussion: )/, '').trim().toLowerCase()
            const match = courseAssignmentCache[bsCourseId].find(a =>
              a.name.trim().toLowerCase() === taskName ||
              taskName.includes(a.name.trim().toLowerCase()) ||
              a.name.trim().toLowerCase().includes(taskName)
            )
            if (match) {
              done = await brightspace.fetchMySubmissions(bsCourseId, match.id, cookie)
              // Also backfill the source_id for future fast lookups
              if (done || !task.source_id) {
                await db.pool.query(
                  `UPDATE todos SET source_id = $1 WHERE id = $2 AND user_id = $3`,
                  [`bs-assignment-${bsCourseId}-${match.id}`, task.id, uid]
                )
              }
            }
          }
          // Grade-name fallback even if no dropbox match was found
          if (!done && matchesGradedItem(task.task, task.course_app_id)) {
            done = true
          }
        } catch (e) {
          console.log(`[check-submissions] Lookup failed for "${task.task}":`, e.message)
        }
      }

      if (done) {
        await db.pool.query('UPDATE todos SET done = true WHERE id = $1 AND user_id = $2', [task.id, uid])
        updated++
      }
    }

    if (updated > 0) {
      const todos = await db.getTodos(uid)
      broadcast('todos', todos)
    }

    res.json({ ok: true, checked: pendingTasks.length, updated })
  } catch (e) {
    console.error('[check-submissions]', e.message)
    res.json({ ok: true, checked: 0, updated: 0 })
  }
})

app.get('/api/course-content', async (req, res) => {
  try { res.json(await db.getCourseContent(getUserId(req))) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/calendar-events', async (req, res) => {
  try { res.json(await db.getCalendarEvents(getUserId(req))) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/updates', async (req, res) => {
  try { res.json(await db.getUpdates(getUserId(req))) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/emails', async (req, res) => {
  try { res.json(await db.getEmails(getUserId(req))) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/notes', async (req, res) => {
  try { res.json(await db.getNotes(getUserId(req))) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/study-sessions', async (req, res) => {
  try { res.json(await db.getStudySessions(getUserId(req))) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/schedule', async (req, res) => {
  try { res.json(await db.getSchedule(getUserId(req))) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/semester', async (req, res) => {
  try {
    const data = await db.getSemester(getUserId(req))
    if (!data) return res.status(404).json({ error: 'Not found' })
    res.json(data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.get('/api/automations', async (req, res) => {
  try { res.json(await db.getAutomations(getUserId(req))) }
  catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Todo CRUD ---
app.post('/api/todos', async (req, res) => {
  try {
    const uid = getUserId(req)
    const newTodo = await db.addTodo(uid, req.body)
    const todos = await db.getTodos(uid)
    broadcast('todos', todos)
    res.status(201).json(newTodo)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.patch('/api/todos/:id', async (req, res) => {
  try {
    const uid = getUserId(req)
    await db.updateTodo(uid, req.params.id, req.body)
    const todos = await db.getTodos(uid)
    broadcast('todos', todos)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/todos/:id', async (req, res) => {
  try {
    const uid = getUserId(req)
    await db.deleteTodo(uid, req.params.id)
    const todos = await db.getTodos(uid)
    broadcast('todos', todos)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Grades CRUD ---
app.post('/api/grades', async (req, res) => {
  try {
    const uid = getUserId(req)
    const { courseId, category, score, maxScore, name } = req.body
    await db.addGrade(uid, courseId, {
      category,
      name: name || category,
      score,
      maxScore: maxScore || 100,
      date: new Date().toISOString().split('T')[0],
    })
    const data = await db.getGrades(uid)
    broadcast('grades', data)
    res.status(201).json(data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/grades/:courseId/:gradeId', async (req, res) => {
  try {
    const uid = getUserId(req)
    await db.deleteGrade(uid, req.params.courseId, req.params.gradeId)
    const data = await db.getGrades(uid)
    broadcast('grades', data)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Notes CRUD ---
app.post('/api/notes', async (req, res) => {
  try {
    const uid = getUserId(req)
    const note = await db.addNote(uid, req.body)
    const notes = await db.getNotes(uid)
    broadcast('notes', notes)
    res.status(201).json(note)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.delete('/api/notes/:id', async (req, res) => {
  try {
    const uid = getUserId(req)
    await db.deleteNote(uid, req.params.id)
    const notes = await db.getNotes(uid)
    broadcast('notes', notes)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Study sessions ---
app.post('/api/study-sessions', async (req, res) => {
  try {
    const uid = getUserId(req)
    const data = await db.addStudySession(uid, req.body)
    broadcast('study-sessions', data)
    res.status(201).json(data)
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Brightspace connection routes ---

// Check Brightspace connection status
app.get('/api/brightspace/status', async (req, res) => {
  try {
    const uid = getUserId(req)
    const tokens = await db.getTokens(uid, 'brightspace')
    const syncInfo = await db.getTokens(uid, 'brightspace_sync')
    res.json({
      connected: !!tokens?.accessToken,
      lastSync: syncInfo?.expiresAt || null,
    })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Connect Brightspace (save session cookie)
app.post('/api/brightspace/connect', async (req, res) => {
  try {
    const uid = getUserId(req)
    const { cookie } = req.body
    if (!cookie) return res.status(400).json({ error: 'Cookie required' })

    // Verify the cookie works by calling whoami
    const userInfo = await brightspace.fetchWhoAmI(cookie)
    if (!userInfo) {
      return res.json({ ok: false, error: 'Invalid or expired session cookie. Make sure you\'re logged into Brightspace and copied the right cookie.' })
    }

    // Save the cookie as a token
    await db.saveTokens(uid, 'brightspace', {
      accessToken: cookie,
      refreshToken: null,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // cookies typically last ~24h
      scopes: `userId:${userInfo.userId}`,
    })

    console.log(`[brightspace] Connected user ${uid} as ${userInfo.firstName} ${userInfo.lastName} (${userInfo.uniqueName})`)
    res.json({ ok: true, userName: `${userInfo.firstName} ${userInfo.lastName}` })
  } catch (e) {
    console.error('[brightspace] Connect error:', e)
    if (e.message === 'BRIGHTSPACE_SESSION_EXPIRED') {
      return res.json({ ok: false, error: 'Session cookie is expired. Log into Brightspace again and get a fresh cookie.' })
    }
    res.json({ ok: false, error: e.message })
  }
})

// Disconnect Brightspace
app.post('/api/brightspace/disconnect', async (req, res) => {
  try {
    const uid = getUserId(req)
    // Remove brightspace tokens
    await db.pool.query('DELETE FROM user_tokens WHERE user_id = $1 AND provider IN ($2, $3)', [uid, 'brightspace', 'brightspace_sync'])
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// Manual sync trigger
app.post('/api/sync', async (req, res) => {
  try {
    const uid = getUserId(req)
    const tokens = await db.getTokens(uid, 'brightspace')
    if (!tokens?.accessToken) {
      return res.json({ ok: false, error: 'Brightspace not connected. Go to Settings to connect.' })
    }

    const results = await syncUserData(uid, tokens.accessToken)

    if (results.errors.some(e => e.includes('SESSION_EXPIRED'))) {
      // Clear the expired token
      await db.pool.query("DELETE FROM user_tokens WHERE user_id = $1 AND provider = 'brightspace'", [uid])
      return res.json({ ok: false, error: 'Brightspace session expired. Please reconnect in Settings.' })
    }

    // Sync emails from Microsoft Graph (independent of Brightspace)
    let emailResults = null
    try {
      const msToken = await refreshMicrosoftToken(uid)
      if (msToken) {
        const courses = await db.getCourses(uid)
        emailResults = await syncEmails(uid, msToken, courses)
      }
    } catch (e) {
      console.log('[sync] Email sync note:', e.message)
    }

    // Broadcast updates to any connected SSE clients
    const [grades, updates, courses, todos, emails, courseContent, calendarEvents] = await Promise.all([
      db.getGrades(uid),
      db.getUpdates(uid),
      db.getCourses(uid),
      db.getTodos(uid),
      db.getEmails(uid),
      db.getCourseContent(uid),
      db.getCalendarEvents(uid),
    ])
    broadcast('grades', grades)
    broadcast('updates', updates)
    broadcast('courses', courses)
    broadcast('todos', todos)
    broadcast('emails', emails)
    broadcast('course-content', courseContent)
    broadcast('calendar-events', calendarEvents)

    res.json({ ok: true, results, emailResults })
  } catch (e) {
    console.error('[sync] Error:', e)
    res.status(500).json({ ok: false, error: e.message })
  }
})

// ─── AI Endpoints ───

// AI Daily Briefing
app.get('/api/ai/briefing', async (req, res) => {
  try {
    const uid = getUserId(req)
    const [courses, gradesData, todos, updates] = await Promise.all([
      db.getCourses(uid),
      db.getGrades(uid),
      db.getTodos(uid),
      db.getUpdates(uid),
    ])
    const grades = Object.entries(gradesData?.courses || {}).map(([id, data]) => ({ course: id, ...data }))
    const briefing = await generateDailyBriefing({ courses, grades, todos, announcements: updates })
    if (!briefing) return res.json({ ok: false, error: 'AI not configured. Add ANTHROPIC_API_KEY to enable.' })
    res.json({ ok: true, briefing })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// AI "What do I need?" grade calculator
app.post('/api/ai/grade-calc', async (req, res) => {
  try {
    const uid = getUserId(req)
    const { courseId, targetGrade } = req.body
    const gradesData = await db.getGrades(uid)
    const courseData = gradesData?.courses?.[courseId]
    if (!courseData) return res.json({ ok: false, error: 'Course not found' })

    const courses = await db.getCourses(uid)
    const course = courses.find(c => c.id === courseId)

    const result = await whatDoINeed({
      courseName: course?.name || courseId,
      currentGrades: courseData.grades || [],
      weights: courseData.weights || {},
      targetGrade: targetGrade || 90,
    })
    if (!result) return res.json({ ok: false, error: 'AI not configured. Add ANTHROPIC_API_KEY to enable.' })
    res.json({ ok: true, result })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// AI Chat — ask anything about your courses, grades, tasks
app.post('/api/ai/chat', async (req, res) => {
  try {
    const uid = getUserId(req)
    const { message } = req.body
    if (!message) return res.status(400).json({ ok: false, error: 'Message required' })

    const API_KEY = process.env.ANTHROPIC_API_KEY
    if (!API_KEY) return res.json({ ok: false, error: 'AI not configured. Add ANTHROPIC_API_KEY to enable.' })

    // Gather all student data for context — EVERYTHING the app has on this student
    const [courses, gradesData, todos, updates, courseContent, calendarEvents, emails, notes] = await Promise.all([
      db.getCourses(uid),
      db.getGrades(uid),
      db.getTodos(uid),
      db.getUpdates(uid),
      db.getCourseContent(uid),
      db.getCalendarEvents(uid),
      db.getEmails(uid),
      db.getNotes(uid),
    ])

    // Compute real GPA and letter grades using weighted categories
    const letterGrade = (pct) => {
      if (pct >= 93) return 'A'; if (pct >= 90) return 'A-'; if (pct >= 87) return 'B+'
      if (pct >= 83) return 'B'; if (pct >= 80) return 'B-'; if (pct >= 77) return 'C+'
      if (pct >= 73) return 'C'; if (pct >= 70) return 'C-'; return 'F'
    }
    const gpaPoints = { 'A': 4.0, 'A-': 3.7, 'B+': 3.3, 'B': 3.0, 'B-': 2.7, 'C+': 2.3, 'C': 2.0, 'C-': 1.7, 'F': 0.0 }

    const courseEntries = Object.entries(gradesData?.courses || {})
    const courseGradeInfo = courseEntries.map(([id, data]) => {
      const grades = data.grades || []
      const weights = data.weights || {}
      if (grades.length === 0) return { id, pct: null, letter: null, gpa: null, grades }

      // Weighted category average (same as frontend)
      const catScores = {}, catCounts = {}
      grades.forEach(g => {
        if (!catScores[g.category]) { catScores[g.category] = 0; catCounts[g.category] = 0 }
        catScores[g.category] += (g.score / g.maxScore) * 100
        catCounts[g.category] += 1
      })
      let totalWeighted = 0, totalWeight = 0
      Object.entries(catScores).forEach(([cat, total]) => {
        const avg = total / catCounts[cat]
        const w = weights[cat]
        const weight = typeof w === 'number' ? w * 100 : (w?.weight != null ? w.weight * 100 : 0)
        if (weight > 0) { totalWeighted += avg * (weight / 100); totalWeight += weight }
      })
      const pct = totalWeight > 0 ? (totalWeighted / totalWeight) * 100 : null
      const letter = pct !== null ? letterGrade(pct) : null
      const gpa = letter ? gpaPoints[letter] || 0 : null
      return { id, pct, letter, gpa, grades }
    })

    const validGPAs = courseGradeInfo.filter(c => c.gpa !== null)
    const overallGPA = validGPAs.length > 0
      ? (validGPAs.reduce((s, c) => s + c.gpa, 0) / validGPAs.length).toFixed(2)
      : 'N/A'

    const today = new Date().toISOString().split('T')[0]
    const pendingTasks = (todos || []).filter(t => !t.done)
    const announcements = (updates || []).filter(u => u.type === 'announcement').slice(0, 10)

    const courseName = (id) => (courses || []).find(c => c.id === id)?.name || id

    // Strip HTML to keep context compact + safe
    const stripHtml = (s) => (s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()

    // Per-course file summary: pick syllabus + top-level modules + a sample of files
    const contentByCourse = {}
    for (const item of (courseContent || [])) {
      if (!contentByCourse[item.course]) contentByCourse[item.course] = []
      contentByCourse[item.course].push(item)
    }
    function findSyllabusItem(items) {
      if (!items) return null
      const leaf = items.find(c => /syllabus/i.test(c.title) && ['file', 'page', 'link', 'pdf', 'pptx', 'docx'].includes(c.type))
      return leaf || items.find(c => /syllabus/i.test(c.title)) || null
    }
    function summarizeCourseFiles(courseId) {
      const items = contentByCourse[courseId] || []
      if (items.length === 0) return '  (no course files synced)'
      const lines = []
      const syl = findSyllabusItem(items)
      if (syl) lines.push(`  Syllabus: "${syl.title}"${syl.url ? ' [' + syl.url + ']' : ''}`)
      // Top-level modules (parentBsId null)
      const topModules = items.filter(i => i.type === 'module' && !i.parentBsId).slice(0, 10)
      if (topModules.length > 0) {
        lines.push(`  Modules: ${topModules.map(m => m.title).join(' | ')}`)
      }
      // Most relevant leaves (non-module), cap at 25 per course to keep context manageable
      const leaves = items.filter(i => i.type !== 'module').slice(0, 25)
      if (leaves.length > 0) {
        lines.push(`  Files (${items.filter(i => i.type !== 'module').length} total, first 25 shown):`)
        leaves.forEach(l => {
          lines.push(`    - [${l.type}] ${l.title}`)
        })
      }
      return lines.join('\n')
    }

    const pendingEmails = (emails || []).slice(0, 15)
    const recentNotes = (notes || []).slice(0, 10)
    const upcomingEvents = (calendarEvents || [])
      .filter(e => e.startDate && new Date(e.startDate) >= new Date(today + 'T00:00:00'))
      .slice(0, 20)

    // Pull grades-with-feedback out so AI can reference professor comments
    const gradesWithFeedback = []
    for (const [cid, cdata] of Object.entries(gradesData?.courses || {})) {
      for (const g of (cdata.grades || [])) {
        if (g.feedback && typeof g.feedback === 'string' && g.feedback.trim()) {
          gradesWithFeedback.push({ course: cid, name: g.name, score: g.score, maxScore: g.maxScore, feedback: stripHtml(g.feedback).slice(0, 400) })
        }
      }
    }

    // Tasks that have a rubric — AI can read grading criteria
    const tasksWithRubrics = (todos || []).filter(t => !t.done && Array.isArray(t.rubric) && t.rubric.length > 0).slice(0, 10)

    const context = `Student's data as of ${today}:

COURSES: ${(courses || []).map(c => `${c.shortCode} - ${c.name} [id: ${c.id}]`).join(', ')}

OVERALL GPA: ${overallGPA}

GRADES BY COURSE:
${courseGradeInfo.map(c => {
  if (!c.pct) return `${courseName(c.id)}: No grades yet`
  const weights = gradesData?.courses?.[c.id]?.weights || {}
  const weightStr = Object.entries(weights).map(([cat, w]) => {
    const wt = typeof w === 'number' ? w * 100 : (w?.weight != null ? w.weight * 100 : 0)
    return `${cat}: ${wt.toFixed(0)}%`
  }).join(', ')
  return `${courseName(c.id)}: ${c.letter} (${c.pct.toFixed(1)}%, ${c.gpa?.toFixed(1)} GPA) — ${c.grades.length} graded items. Weights: ${weightStr || 'equal'}`
}).join('\n')}

GPA SCALE: A=4.0, A-=3.7, B+=3.3, B=3.0, B-=2.7, C+=2.3, C=2.0. Overall GPA = average of course GPAs.

INDIVIDUAL GRADES (with score breakdown):
${courseGradeInfo.flatMap(c => {
  if (!c.grades || c.grades.length === 0) return []
  return c.grades.slice(0, 20).map(g => `- [${courseName(c.id)}] ${g.name} (${g.category}): ${g.score}/${g.maxScore} (${((g.score / g.maxScore) * 100).toFixed(0)}%)`)
}).join('\n') || 'None'}

PROFESSOR FEEDBACK ON GRADED WORK:
${gradesWithFeedback.length > 0 ? gradesWithFeedback.map(f => `- [${courseName(f.course)}] ${f.name} (${f.score}/${f.maxScore}): "${f.feedback}"`).join('\n') : 'No written feedback from professors yet.'}

PENDING TASKS (${pendingTasks.length}):
${pendingTasks.map(t => `- [${courseName(t.course)}] ${t.task}${t.due ? ` (due ${t.due})` : ''} [${t.priority}]${!t.done && t.due && new Date(t.due) < new Date() ? ' OVERDUE' : ''}`).join('\n') || 'None'}

TASKS WITH GRADING RUBRICS:
${tasksWithRubrics.length > 0 ? tasksWithRubrics.map(t => {
  const r = t.rubric[0]
  const crit = (r.criteria || []).slice(0, 5).map(c => c.name).join(', ')
  return `- [${courseName(t.course)}] ${t.task}: ${r.name}${crit ? ` — criteria: ${crit}` : ''}`
}).join('\n') : 'None'}

RECENT ANNOUNCEMENTS (${announcements.length}):
${announcements.map(a => `- [${courseName(a.course)}] ${a.title} (${a.date}): ${stripHtml(a.body).slice(0, 300)}`).join('\n') || 'None'}

UPCOMING CALENDAR EVENTS:
${upcomingEvents.length > 0 ? upcomingEvents.map(e => `- [${courseName(e.course)}] ${e.title} — ${e.startDate}${e.location ? ' @ ' + e.location : ''}`).join('\n') : 'No scheduled events.'}

PROFESSOR EMAILS (recent ${pendingEmails.length}):
${pendingEmails.length > 0 ? pendingEmails.map(e => `- [${courseName(e.course) || 'Unmatched'}] From ${e.from}: ${e.subject}${e.preview ? ' — ' + stripHtml(e.preview).slice(0, 150) : ''}`).join('\n') : 'No synced emails.'}

STUDENT'S OWN NOTES (most recent):
${recentNotes.length > 0 ? recentNotes.map(n => `- [${courseName(n.course) || 'General'}] ${stripHtml(n.text).slice(0, 200)}`).join('\n') : 'No notes.'}

COURSE FILES (synced from Brightspace):
${(courses || []).map(c => `${courseName(c.id)}:\n${summarizeCourseFiles(c.id)}`).join('\n\n')}`

    const apiRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 900,
        system: `You are EduSync AI, a confident and knowledgeable university assistant. You have FULL access to this student's real grades, GPA, tasks, announcements, professor emails, grading rubrics, professor feedback comments, course files (including syllabi), calendar events, and their personal notes.

What you CAN access (all provided in the data below):
- Current GPA + per-course letter grades + category weights + individual grade scores
- Pending tasks (from Brightspace assignments + AI-extracted) with priority and due dates
- Grading rubrics for assignments that have them (criteria + levels)
- Professor feedback comments on graded work
- Recent Brightspace announcements with full body text
- Upcoming Brightspace calendar events
- Professor emails from .edu senders with subject + preview
- Student's personal notes
- Course files — syllabi, modules, uploaded files, links, readings — per course

Rules:
- Answer with authority. Never say "I don't have access" — you have access to all of the above. If the data provided doesn't contain what they asked, say so specifically ("no syllabus file has been uploaded to Brightspace for that course yet" not "I can't see files").
- For syllabus questions: check the COURSE FILES section. If a syllabus file is listed, reference it by name. If no syllabus is in the list for that course, say it hasn't been uploaded yet and suggest where to look (Brightspace content modules, or the professor).
- For grade feedback questions: read the PROFESSOR FEEDBACK section and quote it directly when relevant.
- For rubric questions: read the TASKS WITH GRADING RUBRICS section.
- For "what do I need on the final" or GPA simulation questions, USE the weights and current grades to calculate the exact answer. Show the math briefly. If other categories are ungraded, mention that and note the answer excludes them.
- Keep responses concise (2-4 sentences unless math or quoting is needed). Use bullet points when listing multiple items.
- Be their go-to assistant, not a cautious disclaimer machine.`,
        messages: [{
          role: 'user',
          content: `${context}\n\nStudent's question: ${message}`
        }],
      }),
    })

    if (!apiRes.ok) return res.json({ ok: false, error: 'AI request failed' })
    const data = await apiRes.json()
    res.json({ ok: true, response: data.content?.[0]?.text })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// --- Webhook endpoints (still supported for backward compat with sync script) ---
app.post('/api/webhook/grades', async (req, res) => {
  try {
    const uid = getUserId(req)
    const data = req.body
    if (!data?.courses) return res.status(400).json({ error: 'Expected grades object with courses' })
    for (const [courseId, courseData] of Object.entries(data.courses)) {
      await db.upsertGrades(uid, courseId, courseData)
    }
    const grades = await db.getGrades(uid)
    broadcast('grades', grades)
    res.json({ ok: true })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/webhook/updates', async (req, res) => {
  try {
    const uid = getUserId(req)
    const updates = req.body
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Expected an array' })
    await db.upsertUpdates(uid, updates)
    const data = await db.getUpdates(uid)
    broadcast('updates', data)
    res.json({ ok: true, count: updates.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/webhook/emails', async (req, res) => {
  try {
    const uid = getUserId(req)
    const emails = req.body
    if (!Array.isArray(emails)) return res.status(400).json({ error: 'Expected an array' })
    await db.upsertEmails(uid, emails)
    const data = await db.getEmails(uid)
    broadcast('emails', data)
    res.json({ ok: true, count: emails.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/webhook/todos', async (req, res) => {
  try {
    const uid = getUserId(req)
    const todos = req.body
    if (!Array.isArray(todos)) return res.status(400).json({ error: 'Expected an array' })
    for (const t of todos) {
      await db.addTodo(uid, { course: t.course, task: t.task || t.title, due: t.due, done: t.done, priority: t.priority })
    }
    const data = await db.getTodos(uid)
    broadcast('todos', data)
    res.json({ ok: true, count: todos.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

app.post('/api/webhook/automations', async (req, res) => {
  try {
    const uid = getUserId(req)
    const automations = req.body
    if (!Array.isArray(automations)) return res.status(400).json({ error: 'Expected an array' })
    await db.upsertAutomations(uid, automations)
    const data = await db.getAutomations(uid)
    broadcast('automations', data)
    res.json({ ok: true, count: automations.length })
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Search endpoint ---
app.get('/api/search', async (req, res) => {
  try {
    const query = req.query.q || ''
    if (!query) return res.json({ updates: [], todos: [], emails: [] })
    res.json(await db.search(getUserId(req), query))
  } catch (e) { res.status(500).json({ error: e.message }) }
})

// --- Export weekly summary ---
app.get('/api/export-summary', async (req, res) => {
  try {
    const uid = getUserId(req)
    const updates = await db.getUpdates(uid)
    const todos = await db.getTodos(uid)
    const courses = await db.getCourses(uid)

    const getCourse = (id) => courses.find(c => c.id === id)?.name || id
    const today = new Date()
    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()))
    const weekEndStr = weekEnd.toISOString().split('T')[0]
    const todayStr = today.toISOString().split('T')[0]

    const urgent = updates.filter(u => u.urgency === 'urgent')
    const upcoming = updates.filter(u => u.type === 'assignment' && u.date <= weekEndStr && u.date >= todayStr)
    const pendingTodos = todos.filter(t => !t.done)

    let summary = `EDUSYNC — WEEKLY SUMMARY\n`
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

// ─── Auto-sync every 2 hours ───
// Syncs all users who have a valid Brightspace connection
async function autoSyncAll() {
  try {
    const { rows } = await db.pool.query(
      `SELECT DISTINCT ut.user_id, ut.access_token
       FROM user_tokens ut WHERE ut.provider = 'brightspace' AND ut.access_token IS NOT NULL`
    )
    if (rows.length === 0) return
    console.log(`[auto-sync] Starting sync for ${rows.length} users...`)
    for (const row of rows) {
      try {
        const results = await syncUserData(row.user_id, row.access_token)
        console.log(`[auto-sync] User ${row.user_id}: ${results.courses} courses, ${results.grades} grades, ${results.tasks || 0} tasks`)

        // Also sync Microsoft emails
        try {
          const msToken = await refreshMicrosoftToken(row.user_id)
          if (msToken) {
            const courses = await db.getCourses(row.user_id)
            const emailResults = await syncEmails(row.user_id, msToken, courses)
            console.log(`[auto-sync] User ${row.user_id}: ${emailResults.synced} emails synced`)
          }
        } catch (e) {
          console.log(`[auto-sync] Email sync note for user ${row.user_id}:`, e.message)
        }
      } catch (e) {
        console.error(`[auto-sync] User ${row.user_id} failed:`, e.message)
      }
    }
    console.log('[auto-sync] Complete')
  } catch (e) {
    console.error('[auto-sync] Failed:', e.message)
  }
}

const FIFTEEN_MIN = 15 * 60 * 1000
setInterval(autoSyncAll, FIFTEEN_MIN)
// Also run first sync 30 seconds after startup (let DB connect first)
setTimeout(autoSyncAll, 30_000)

const port = process.env.PORT || PORT
app.listen(port, () => {
  console.log(`\n  EduSync server running at http://localhost:${port}`)
  console.log(`  Auto-sync enabled: every 15 minutes`)
})
