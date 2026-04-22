import pg from 'pg'

const { Pool } = pg

// On Railway: DATABASE_URL is internal. Locally: use DATABASE_PUBLIC_URL (the external one)
const connString = process.env.DATABASE_URL || process.env.DATABASE_PUBLIC_URL

const pool = new Pool({
  connectionString: connString,
  ssl: connString?.includes('railway') ? { rejectUnauthorized: false } : false,
})

// Test connection + run migrations
pool.query('SELECT NOW()').then(async () => {
  console.log('[db] Connected to PostgreSQL')
  // Add source tracking columns to todos table (idempotent)
  try {
    await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'manual'`)
    await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS source_id VARCHAR(200)`)
    // Feature 4: rubric data (JSONB) for synced assignments
    await pool.query(`ALTER TABLE todos ADD COLUMN IF NOT EXISTS rubric JSONB`)
    // Create unique index for upsert dedup (only on non-null source_id)
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS todos_user_source_id_idx ON todos(user_id, source_id) WHERE source_id IS NOT NULL`)
    // Course content table (Feature 1)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS course_content (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        course_app_id VARCHAR(100),
        bs_id VARCHAR(100),
        parent_bs_id VARCHAR(100),
        title VARCHAR(500),
        type VARCHAR(50),
        url TEXT,
        description TEXT,
        due_date DATE,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS course_content_user_course_idx ON course_content(user_id, course_app_id)`)
    // Calendar events table (Feature 3)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS calendar_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        course_app_id VARCHAR(100),
        bs_event_id VARCHAR(100),
        title VARCHAR(500),
        description TEXT,
        start_date TIMESTAMP,
        end_date TIMESTAMP,
        location VARCHAR(255),
        event_type VARCHAR(50),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)
    await pool.query(`CREATE INDEX IF NOT EXISTS calendar_events_user_idx ON calendar_events(user_id, start_date)`)
    console.log('[db] Migrations complete')
  } catch (e) {
    console.log('[db] Migration note:', e.message)
  }
}).catch(err => {
  console.error('[db] Connection failed:', err.message)
})

// ─── Helper ───
const q = (text, params) => pool.query(text, params)

// ─── Courses ───
// Returns: [ { id, name, shortCode, color, professor, schedule, folders } ]
async function getCourses(userId) {
  const { rows } = await q(
    'SELECT app_id AS id, name, short_code AS "shortCode", color, professor, schedule, folders FROM courses WHERE user_id = $1 ORDER BY name',
    [userId]
  )
  return rows
}

async function upsertCourse(userId, course) {
  await q(
    `INSERT INTO courses (user_id, brightspace_id, app_id, name, short_code, color, professor, schedule, folders)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, app_id) DO UPDATE SET
       name = EXCLUDED.name, short_code = EXCLUDED.short_code, color = EXCLUDED.color,
       professor = EXCLUDED.professor, schedule = EXCLUDED.schedule, folders = EXCLUDED.folders`,
    [userId, course.brightspaceId || null, course.id, course.name, course.shortCode, course.color, course.professor,
     JSON.stringify(course.schedule), JSON.stringify(course.folders)]
  )
}

// ─── Grades ───
// Returns: { courses: { [appId]: { weights: {...}, grades: [...] } } }
async function getGrades(userId) {
  const courses = {}

  // Get all weights
  const { rows: weights } = await q(
    'SELECT course_app_id, category, weight, points FROM grade_weights WHERE user_id = $1',
    [userId]
  )
  for (const w of weights) {
    if (!courses[w.course_app_id]) courses[w.course_app_id] = { weights: {}, grades: [] }
    courses[w.course_app_id].weights[w.category] = { weight: parseFloat(w.weight) }
    if (w.points) courses[w.course_app_id].weights[w.category].points = parseFloat(w.points)
  }

  // Get all grades
  const { rows: grades } = await q(
    `SELECT course_app_id, brightspace_id, category, name, score, max_score AS "maxScore", date
     FROM grades WHERE user_id = $1 ORDER BY date DESC`,
    [userId]
  )
  for (const g of grades) {
    if (!courses[g.course_app_id]) courses[g.course_app_id] = { weights: {}, grades: [] }
    courses[g.course_app_id].grades.push({
      id: g.brightspace_id || `grade-${g.course_app_id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      category: g.category,
      name: g.name,
      score: parseFloat(g.score),
      maxScore: parseFloat(g.maxScore),
      date: g.date ? g.date.toISOString().split('T')[0] : null,
    })
  }

  return { courses }
}

async function addGrade(userId, courseId, grade) {
  const { rows } = await q(
    `INSERT INTO grades (user_id, course_app_id, brightspace_id, category, name, score, max_score, date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [userId, courseId, grade.id || null, grade.category, grade.name || grade.category, grade.score, grade.maxScore || 100, grade.date || new Date()]
  )
  return rows[0].id
}

async function deleteGrade(userId, courseId, gradeId) {
  // gradeId could be a brightspace_id like "grade-managing-bs-802401" or a db id
  await q(
    'DELETE FROM grades WHERE user_id = $1 AND course_app_id = $2 AND brightspace_id = $3',
    [userId, courseId, gradeId]
  )
}

async function upsertGrades(userId, courseAppId, gradesData) {
  // gradesData = { weights: { category: { weight, points } }, grades: [ { id, category, name, score, maxScore, date } ] }
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Upsert weights
    if (gradesData.weights) {
      for (const [category, w] of Object.entries(gradesData.weights)) {
        await client.query(
          `INSERT INTO grade_weights (user_id, course_app_id, category, weight, points)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (user_id, course_app_id, category) DO UPDATE SET weight = EXCLUDED.weight, points = EXCLUDED.points`,
          [userId, courseAppId, category, w.weight, w.points || null]
        )
      }
    }

    // Replace all grades for this course (sync approach)
    if (gradesData.grades) {
      await client.query('DELETE FROM grades WHERE user_id = $1 AND course_app_id = $2', [userId, courseAppId])
      for (const g of gradesData.grades) {
        await client.query(
          `INSERT INTO grades (user_id, course_app_id, brightspace_id, category, name, score, max_score, date)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [userId, courseAppId, g.id || null, g.category, g.name, g.score, g.maxScore || 100, g.date || new Date()]
        )
      }
    }

    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

// ─── Todos ───
// Returns: [ { id, course, task, due, done, priority, rubric } ]
async function getTodos(userId) {
  const { rows } = await q(
    `SELECT id, course_app_id AS course, task, due, done, priority, source, rubric
     FROM todos WHERE user_id = $1 ORDER BY due ASC`,
    [userId]
  )
  return rows.map(t => ({
    ...t,
    id: `todo-${t.id}`,
    due: t.due ? t.due.toISOString().split('T')[0] : null,
    source: t.source || 'manual',
    rubric: t.rubric || null,
  }))
}

async function addTodo(userId, todo) {
  const { rows } = await q(
    `INSERT INTO todos (user_id, course_app_id, task, due, done, priority)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [userId, todo.course, todo.task, todo.due, todo.done || false, todo.priority || 'medium']
  )
  return { id: `todo-${rows[0].id}`, course: todo.course, task: todo.task, due: todo.due, done: false, priority: todo.priority || 'medium' }
}

async function updateTodo(userId, todoId, updates) {
  const dbId = parseInt(todoId.replace('todo-', ''))
  const fields = []
  const values = [userId, dbId]
  let idx = 3
  if ('done' in updates) { fields.push(`done = $${idx++}`); values.push(updates.done) }
  if ('task' in updates) { fields.push(`task = $${idx++}`); values.push(updates.task) }
  if ('due' in updates) { fields.push(`due = $${idx++}`); values.push(updates.due) }
  if ('priority' in updates) { fields.push(`priority = $${idx++}`); values.push(updates.priority) }
  if ('course' in updates) { fields.push(`course_app_id = $${idx++}`); values.push(updates.course) }
  if (fields.length === 0) return
  await q(`UPDATE todos SET ${fields.join(', ')} WHERE user_id = $1 AND id = $2`, values)
}

async function deleteTodo(userId, todoId) {
  const dbId = parseInt(todoId.replace('todo-', ''))
  await q('DELETE FROM todos WHERE user_id = $1 AND id = $2', [userId, dbId])
}

// Upsert a synced todo — inserts if source_id doesn't exist, updates on conflict.
// Rubric (JSONB, optional) overwrites on update when provided.
async function upsertSyncedTodo(userId, todo) {
  const rubricJson = todo.rubric ? JSON.stringify(todo.rubric) : null
  const { rows } = await q(
    `INSERT INTO todos (user_id, course_app_id, task, due, done, priority, source, source_id, rubric)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id, source_id) WHERE source_id IS NOT NULL
     DO UPDATE SET
       done = EXCLUDED.done,
       task = EXCLUDED.task,
       due = EXCLUDED.due,
       rubric = COALESCE(EXCLUDED.rubric, todos.rubric)
     RETURNING id`,
    [userId, todo.course, todo.task, todo.due || null, todo.done || false, todo.priority || 'medium', todo.source || 'brightspace', todo.sourceId, rubricJson]
  )
  return rows[0]?.id
}

// Mark synced todo as done by source_id
async function markSyncedTodoDone(userId, sourceId) {
  await q(
    `UPDATE todos SET done = true WHERE user_id = $1 AND source_id = $2`,
    [userId, sourceId]
  )
}

// ─── Announcements / Updates ───
// Returns: [ { id, course, title, body, date, type, read } ]
async function getUpdates(userId) {
  const { rows } = await q(
    `SELECT id, course_app_id AS course, title, body, date, type, urgency, read, source_url
     FROM announcements WHERE user_id = $1 ORDER BY date DESC`,
    [userId]
  )
  return rows.map(r => ({
    ...r,
    date: r.date ? r.date.toISOString().split('T')[0] : null,
  }))
}

async function upsertUpdates(userId, updates) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM announcements WHERE user_id = $1', [userId])
    for (const u of updates) {
      await client.query(
        `INSERT INTO announcements (user_id, course_app_id, title, body, date, type, urgency, read, source_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [userId, u.course, u.title, u.body || '', u.date, u.type || 'announcement', u.urgency || null, u.read || false, u.source_url || null]
      )
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

// ─── Course Content (Brightspace modules/files/links) ───
// Returns: [ { id, course, bsId, parentBsId, title, type, url, description, dueDate, sortOrder } ]
async function getCourseContent(userId) {
  const { rows } = await q(
    `SELECT id, course_app_id AS course, bs_id AS "bsId", parent_bs_id AS "parentBsId",
            title, type, url, description, due_date AS "dueDate", sort_order AS "sortOrder"
     FROM course_content WHERE user_id = $1 ORDER BY course_app_id, sort_order`,
    [userId]
  )
  return rows.map(r => ({
    ...r,
    dueDate: r.dueDate ? r.dueDate.toISOString().split('T')[0] : null,
  }))
}

async function upsertCourseContent(userId, appId, items) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'DELETE FROM course_content WHERE user_id = $1 AND course_app_id = $2',
      [userId, appId]
    )
    for (const item of items) {
      await client.query(
        `INSERT INTO course_content
         (user_id, course_app_id, bs_id, parent_bs_id, title, type, url, description, due_date, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          userId, appId, item.bsId, item.parentBsId || null,
          (item.title || '').slice(0, 500),
          item.type || 'page',
          item.url || null,
          item.description || '',
          item.dueDate ? new Date(item.dueDate) : null,
          item.sortOrder ?? 0,
        ]
      )
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

// ─── Calendar Events (Brightspace) ───
// Returns: [ { id, course, bsEventId, title, description, startDate, endDate, location, eventType } ]
async function getCalendarEvents(userId) {
  const { rows } = await q(
    `SELECT id, course_app_id AS course, bs_event_id AS "bsEventId",
            title, description, start_date AS "startDate", end_date AS "endDate",
            location, event_type AS "eventType"
     FROM calendar_events WHERE user_id = $1 ORDER BY start_date`,
    [userId]
  )
  return rows.map(r => ({
    ...r,
    startDate: r.startDate ? r.startDate.toISOString() : null,
    endDate: r.endDate ? r.endDate.toISOString() : null,
  }))
}

async function upsertCalendarEvents(userId, appId, events) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      'DELETE FROM calendar_events WHERE user_id = $1 AND course_app_id = $2',
      [userId, appId]
    )
    for (const e of events) {
      await client.query(
        `INSERT INTO calendar_events
         (user_id, course_app_id, bs_event_id, title, description, start_date, end_date, location, event_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          userId, appId, String(e.id || ''),
          (e.title || '').slice(0, 500),
          e.description || '',
          e.startDate ? new Date(e.startDate) : null,
          e.endDate ? new Date(e.endDate) : null,
          (e.location || '').slice(0, 255),
          (e.eventType || 'calendar').slice(0, 50),
        ]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Emails ───
// Returns: [ { id, course, subject, from, date, preview, important } ]
async function getEmails(userId) {
  const { rows } = await q(
    `SELECT id, course_app_id AS course, subject, from_name AS "from", date, preview, important
     FROM emails WHERE user_id = $1 ORDER BY date DESC`,
    [userId]
  )
  return rows.map(r => ({
    ...r,
    id: `email-${r.id}`,
    date: r.date ? r.date.toISOString().split('T')[0] : null,
  }))
}

async function upsertEmails(userId, emails) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM emails WHERE user_id = $1', [userId])
    for (const e of emails) {
      await client.query(
        `INSERT INTO emails (user_id, course_app_id, subject, from_name, from_email, date, preview, important)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, e.course, e.subject, e.from, e.fromEmail || null, e.date, e.preview, e.important || false]
      )
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

// ─── Notes ───
// Returns: [ { id, course, text, date } ]
async function getNotes(userId) {
  const { rows } = await q(
    `SELECT id, course_app_id AS course, text, date
     FROM notes WHERE user_id = $1 ORDER BY date DESC`,
    [userId]
  )
  return rows.map(r => ({
    id: `note-${r.id}`,
    course: r.course,
    text: r.text,
    date: r.date ? r.date.toISOString() : null,
  }))
}

async function addNote(userId, note) {
  const { rows } = await q(
    `INSERT INTO notes (user_id, course_app_id, text, date)
     VALUES ($1, $2, $3, $4) RETURNING id, date`,
    [userId, note.course, note.text, new Date()]
  )
  return { id: `note-${rows[0].id}`, course: note.course, text: note.text, date: rows[0].date.toISOString() }
}

async function deleteNote(userId, noteId) {
  const dbId = parseInt(noteId.replace('note-', ''))
  await q('DELETE FROM notes WHERE user_id = $1 AND id = $2', [userId, dbId])
}

// ─── Study Sessions ───
// Returns: { sessions: [...], streaks: { current, best, lastCompleted } }
async function getStudySessions(userId) {
  const { rows: sessions } = await q(
    `SELECT id, course_app_id AS course, duration, date
     FROM study_sessions WHERE user_id = $1 ORDER BY date DESC`,
    [userId]
  )

  const { rows: streakRows } = await q(
    'SELECT current_streak, best_streak, last_completed FROM streaks WHERE user_id = $1',
    [userId]
  )
  const streak = streakRows[0] || { current_streak: 0, best_streak: 0, last_completed: null }

  return {
    sessions: sessions.map(s => ({
      id: `study-${s.id}`,
      course: s.course,
      duration: s.duration,
      date: s.date ? s.date.toISOString() : null,
    })),
    streaks: {
      current: streak.current_streak,
      best: streak.best_streak,
      lastCompleted: streak.last_completed ? streak.last_completed.toISOString().split('T')[0] : null,
    },
  }
}

async function addStudySession(userId, session) {
  await q(
    `INSERT INTO study_sessions (user_id, course_app_id, duration, date)
     VALUES ($1, $2, $3, $4)`,
    [userId, session.course, session.duration, new Date()]
  )

  // Update streak
  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  const { rows } = await q('SELECT current_streak, best_streak, last_completed FROM streaks WHERE user_id = $1', [userId])

  let current = 1
  let best = 1
  if (rows.length > 0) {
    const lastStr = rows[0].last_completed ? rows[0].last_completed.toISOString().split('T')[0] : null
    if (lastStr === yesterday) {
      current = rows[0].current_streak + 1
    } else if (lastStr === today) {
      current = rows[0].current_streak
    }
    best = Math.max(current, rows[0].best_streak)
  }

  await q(
    `INSERT INTO streaks (user_id, current_streak, best_streak, last_completed)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET current_streak = EXCLUDED.current_streak, best_streak = EXCLUDED.best_streak, last_completed = EXCLUDED.last_completed`,
    [userId, current, best, today]
  )

  return getStudySessions(userId)
}

// ─── Schedule ───
// Returns: { days: { Mon: [...], Tue: [...], ... } }
async function getSchedule(userId) {
  const { rows } = await q('SELECT days FROM schedules WHERE user_id = $1', [userId])
  if (rows.length === 0) return { days: { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [] } }
  return { days: rows[0].days }
}

async function upsertSchedule(userId, schedule) {
  await q(
    `INSERT INTO schedules (user_id, days) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET days = EXCLUDED.days`,
    [userId, JSON.stringify(schedule.days)]
  )
}

// ─── Semester ───
// Returns: { name, startDate, endDate, holidays }
async function getSemester(userId) {
  const { rows } = await q(
    'SELECT name, start_date AS "startDate", end_date AS "endDate", holidays FROM semester_info WHERE user_id = $1',
    [userId]
  )
  if (rows.length === 0) return null
  const r = rows[0]
  return {
    name: r.name,
    startDate: r.startDate ? r.startDate.toISOString().split('T')[0] : null,
    endDate: r.endDate ? r.endDate.toISOString().split('T')[0] : null,
    holidays: r.holidays,
  }
}

async function upsertSemester(userId, semester) {
  await q(
    `INSERT INTO semester_info (user_id, name, start_date, end_date, holidays)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE SET
       name = EXCLUDED.name, start_date = EXCLUDED.start_date,
       end_date = EXCLUDED.end_date, holidays = EXCLUDED.holidays`,
    [userId, semester.name, semester.startDate, semester.endDate, JSON.stringify(semester.holidays)]
  )
}

// ─── Automations ───
// Returns: [ { id, name, description, schedule, lastRun, status } ]
async function getAutomations(userId) {
  const { rows } = await q(
    `SELECT id, name, description, schedule, last_run AS "lastRun", status
     FROM automations WHERE user_id = $1`,
    [userId]
  )
  return rows
}

async function upsertAutomations(userId, automations) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('DELETE FROM automations WHERE user_id = $1', [userId])
    for (const a of automations) {
      await client.query(
        `INSERT INTO automations (user_id, name, description, schedule, last_run, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, a.name, a.description, a.schedule, a.lastRun || null, a.status || 'active']
      )
    }
    await client.query('COMMIT')
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}

// ─── Users ───
async function findOrCreateUser(microsoftId, email, displayName) {
  // Check by Microsoft ID first
  const { rows } = await q('SELECT id FROM users WHERE microsoft_id = $1', [microsoftId])
  if (rows.length > 0) return rows[0].id

  // Check by email (user may exist from seed data without a Microsoft ID)
  const { rows: emailRows } = await q('SELECT id FROM users WHERE email = $1', [email])
  if (emailRows.length > 0) {
    // Link existing user to their Microsoft account
    await q('UPDATE users SET microsoft_id = $1, display_name = $2 WHERE id = $3', [microsoftId, displayName, emailRows[0].id])
    return emailRows[0].id
  }

  const result = await q(
    `INSERT INTO users (microsoft_id, email, display_name) VALUES ($1, $2, $3) RETURNING id`,
    [microsoftId, email, displayName]
  )
  return result.rows[0].id
}

async function getUser(userId) {
  const { rows } = await q('SELECT id, email, display_name AS "displayName" FROM users WHERE id = $1', [userId])
  return rows[0] || null
}

// ─── Tokens ───
async function saveTokens(userId, provider, tokens) {
  await q(
    `INSERT INTO user_tokens (user_id, provider, access_token, refresh_token, expires_at, scopes)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id, provider) DO UPDATE SET
       access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token,
       expires_at = EXCLUDED.expires_at, scopes = EXCLUDED.scopes, updated_at = NOW()`,
    [userId, provider, tokens.accessToken, tokens.refreshToken, tokens.expiresAt, tokens.scopes || null]
  )
}

async function getTokens(userId, provider) {
  const { rows } = await q(
    'SELECT access_token AS "accessToken", refresh_token AS "refreshToken", expires_at AS "expiresAt", scopes FROM user_tokens WHERE user_id = $1 AND provider = $2',
    [userId, provider]
  )
  return rows[0] || null
}

// ─── Search ───
async function search(userId, query) {
  const pattern = `%${query}%`
  const [updates, todos, emails] = await Promise.all([
    q(`SELECT id, course_app_id AS course, title, body, date, type, read FROM announcements
       WHERE user_id = $1 AND (title ILIKE $2 OR body ILIKE $2) ORDER BY date DESC`, [userId, pattern]),
    q(`SELECT id, course_app_id AS course, task, due, done, priority FROM todos
       WHERE user_id = $1 AND task ILIKE $2 ORDER BY due ASC`, [userId, pattern]),
    q(`SELECT id, course_app_id AS course, subject, from_name AS "from", date, preview, important FROM emails
       WHERE user_id = $1 AND (subject ILIKE $2 OR preview ILIKE $2) ORDER BY date DESC`, [userId, pattern]),
  ])
  return {
    updates: updates.rows.map(r => ({ ...r, date: r.date?.toISOString().split('T')[0] })),
    todos: todos.rows.map(t => ({ ...t, id: `todo-${t.id}`, due: t.due?.toISOString().split('T')[0] })),
    emails: emails.rows.map(e => ({ ...e, id: `email-${e.id}`, date: e.date?.toISOString().split('T')[0] })),
  }
}

// ─── Cleanup: remove old courses ───
async function deleteCoursesNotIn(userId, currentAppIds) {
  if (!currentAppIds || currentAppIds.length === 0) return
  const placeholders = currentAppIds.map((_, i) => `$${i + 2}`).join(', ')
  // Delete grades, announcements, todos, etc. for old courses first
  await q(`DELETE FROM grades WHERE user_id = $1 AND course_app_id NOT IN (${placeholders})`, [userId, ...currentAppIds])
  await q(`DELETE FROM grade_weights WHERE user_id = $1 AND course_app_id NOT IN (${placeholders})`, [userId, ...currentAppIds])
  await q(`DELETE FROM announcements WHERE user_id = $1 AND course_app_id NOT IN (${placeholders})`, [userId, ...currentAppIds])
  await q(`DELETE FROM courses WHERE user_id = $1 AND app_id NOT IN (${placeholders})`, [userId, ...currentAppIds])
}

// ─── Export ───
export default {
  pool,
  getCourses, upsertCourse,
  getGrades, addGrade, deleteGrade, upsertGrades,
  getTodos, addTodo, updateTodo, deleteTodo, upsertSyncedTodo, markSyncedTodoDone,
  getUpdates, upsertUpdates,
  getCourseContent, upsertCourseContent,
  getCalendarEvents, upsertCalendarEvents,
  getEmails, upsertEmails,
  getNotes, addNote, deleteNote,
  getStudySessions, addStudySession,
  getSchedule, upsertSchedule,
  getSemester, upsertSemester,
  getAutomations, upsertAutomations,
  findOrCreateUser, getUser,
  saveTokens, getTokens,
  search,
  deleteCoursesNotIn,
}
