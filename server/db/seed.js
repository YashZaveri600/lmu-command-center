#!/usr/bin/env node
/**
 * Seed script: migrates existing JSON data files into PostgreSQL.
 * Creates user ID 1 (Yash) and imports all data.
 *
 * Usage: node server/db/seed.js
 * Requires DATABASE_URL in .env
 */

import 'dotenv/config'
import pg from 'pg'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '..', '..', 'data')

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('railway') ? { rejectUnauthorized: false } : false,
})

function readJSON(filename) {
  const filepath = path.join(DATA_DIR, filename)
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'))
  } catch {
    console.log(`  [skip] ${filename} not found or invalid`)
    return null
  }
}

async function seed() {
  const client = await pool.connect()

  try {
    console.log('Starting database seed...\n')

    // Run schema
    console.log('1. Creating tables...')
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8')
    await client.query(schema)
    console.log('   Done.\n')

    await client.query('BEGIN')

    // Create user 1 (Yash)
    console.log('2. Creating user...')
    await client.query(
      `INSERT INTO users (id, email, display_name) VALUES (1, 'yzaveri1@lion.lmu.edu', 'Yash Zaveri')
       ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name`
    )
    // Reset sequence so next user gets id 2
    await client.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`)
    console.log('   Created user: Yash Zaveri (id=1)\n')

    const userId = 1

    // Import courses
    console.log('3. Importing courses...')
    const courses = readJSON('courses.json')
    if (courses && Array.isArray(courses)) {
      for (const c of courses) {
        await client.query(
          `INSERT INTO courses (user_id, app_id, name, short_code, color, professor, schedule, folders)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (user_id, app_id) DO UPDATE SET
             name = EXCLUDED.name, short_code = EXCLUDED.short_code, color = EXCLUDED.color,
             professor = EXCLUDED.professor, schedule = EXCLUDED.schedule, folders = EXCLUDED.folders`,
          [userId, c.id, c.name, c.shortCode, c.color, c.professor,
           JSON.stringify(c.schedule), JSON.stringify(c.folders)]
        )
      }
      console.log(`   Imported ${courses.length} courses.\n`)
    }

    // Import grades + weights
    console.log('4. Importing grades...')
    const gradesData = readJSON('grades.json')
    if (gradesData?.courses) {
      let gradeCount = 0
      let weightCount = 0
      for (const [courseId, courseData] of Object.entries(gradesData.courses)) {
        // Weights
        if (courseData.weights) {
          for (const [category, w] of Object.entries(courseData.weights)) {
            await client.query(
              `INSERT INTO grade_weights (user_id, course_app_id, category, weight, points)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (user_id, course_app_id, category) DO UPDATE SET weight = EXCLUDED.weight, points = EXCLUDED.points`,
              [userId, courseId, category, w.weight, w.points || null]
            )
            weightCount++
          }
        }
        // Grades
        if (courseData.grades) {
          for (const g of courseData.grades) {
            await client.query(
              `INSERT INTO grades (user_id, course_app_id, brightspace_id, category, name, score, max_score, date)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [userId, courseId, g.id || null, g.category, g.name, g.score, g.maxScore || 100, g.date || null]
            )
            gradeCount++
          }
        }
      }
      console.log(`   Imported ${gradeCount} grades, ${weightCount} weight categories.\n`)
    }

    // Import todos
    console.log('5. Importing todos...')
    const todos = readJSON('weekly_todos.json')
    if (todos && Array.isArray(todos)) {
      for (const t of todos) {
        await client.query(
          `INSERT INTO todos (user_id, course_app_id, task, due, done, priority)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, t.course, t.task || t.title, t.due, t.done || false, t.priority || 'medium']
        )
      }
      console.log(`   Imported ${todos.length} todos.\n`)
    }

    // Import announcements
    console.log('6. Importing announcements...')
    const updates = readJSON('brightspace_updates.json')
    if (updates && Array.isArray(updates)) {
      for (const u of updates) {
        await client.query(
          `INSERT INTO announcements (user_id, course_app_id, title, body, date, type, urgency, read)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [userId, u.course, u.title, u.body || '', u.date, u.type || 'announcement', u.urgency || null, u.read || false]
        )
      }
      console.log(`   Imported ${updates.length} announcements.\n`)
    }

    // Import emails
    console.log('7. Importing emails...')
    const emails = readJSON('professor_emails.json')
    if (emails && Array.isArray(emails)) {
      for (const e of emails) {
        await client.query(
          `INSERT INTO emails (user_id, course_app_id, subject, from_name, date, preview, important)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [userId, e.course, e.subject, e.from, e.date, e.preview, e.important || false]
        )
      }
      console.log(`   Imported ${emails.length} emails.\n`)
    }

    // Import notes
    console.log('8. Importing notes...')
    const notes = readJSON('notes.json')
    if (notes && Array.isArray(notes) && notes.length > 0) {
      for (const n of notes) {
        await client.query(
          `INSERT INTO notes (user_id, course_app_id, text, date)
           VALUES ($1, $2, $3, $4)`,
          [userId, n.course, n.text, n.date || new Date()]
        )
      }
      console.log(`   Imported ${notes.length} notes.\n`)
    } else {
      console.log('   No notes to import.\n')
    }

    // Import study sessions + streaks
    console.log('9. Importing study sessions...')
    const studyData = readJSON('study_sessions.json')
    if (studyData?.sessions && studyData.sessions.length > 0) {
      for (const s of studyData.sessions) {
        await client.query(
          `INSERT INTO study_sessions (user_id, course_app_id, duration, date)
           VALUES ($1, $2, $3, $4)`,
          [userId, s.course, s.duration, s.date || new Date()]
        )
      }
      console.log(`   Imported ${studyData.sessions.length} sessions.`)
    } else {
      console.log('   No sessions to import.')
    }
    if (studyData?.streaks) {
      await client.query(
        `INSERT INTO streaks (user_id, current_streak, best_streak, last_completed)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id) DO UPDATE SET current_streak = EXCLUDED.current_streak, best_streak = EXCLUDED.best_streak, last_completed = EXCLUDED.last_completed`,
        [userId, studyData.streaks.current || 0, studyData.streaks.best || 0, studyData.streaks.lastCompleted || null]
      )
    }
    console.log()

    // Import schedule
    console.log('10. Importing schedule...')
    const schedule = readJSON('schedule.json')
    if (schedule?.days) {
      await client.query(
        `INSERT INTO schedules (user_id, days) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET days = EXCLUDED.days`,
        [userId, JSON.stringify(schedule.days)]
      )
      console.log('    Done.\n')
    }

    // Import semester
    console.log('11. Importing semester info...')
    const semester = readJSON('semester.json')
    if (semester) {
      await client.query(
        `INSERT INTO semester_info (user_id, name, start_date, end_date, holidays)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, semester.name, semester.startDate, semester.endDate, JSON.stringify(semester.holidays)]
      )
      console.log('    Done.\n')
    }

    // Import automations
    console.log('12. Importing automations...')
    const automations = readJSON('automations.json')
    if (automations && Array.isArray(automations)) {
      for (const a of automations) {
        await client.query(
          `INSERT INTO automations (user_id, name, description, schedule, last_run, status)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [userId, a.name, a.description, a.schedule, a.lastRun || null, a.status || 'active']
        )
      }
      console.log(`    Imported ${automations.length} automations.\n`)
    }

    await client.query('COMMIT')
    console.log('=== Seed complete! All JSON data migrated to PostgreSQL. ===')
  } catch (e) {
    await client.query('ROLLBACK')
    console.error('Seed failed:', e.message)
    console.error(e.stack)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
