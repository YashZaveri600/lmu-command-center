-- LMU Command Center Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  microsoft_id VARCHAR(255) UNIQUE,
  email VARCHAR(255) UNIQUE NOT NULL,
  display_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- OAuth tokens (encrypted at rest)
CREATE TABLE IF NOT EXISTS user_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  access_token TEXT,
  refresh_token TEXT,
  expires_at TIMESTAMP,
  scopes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  brightspace_id INTEGER,
  app_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  short_code VARCHAR(20),
  color VARCHAR(20),
  professor VARCHAR(255),
  schedule JSONB,
  folders JSONB,
  UNIQUE(user_id, app_id)
);

-- Grade weights per course
CREATE TABLE IF NOT EXISTS grade_weights (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_app_id VARCHAR(100) NOT NULL,
  category VARCHAR(255) NOT NULL,
  weight DECIMAL(5,4),
  points DECIMAL(10,2),
  UNIQUE(user_id, course_app_id, category)
);

-- Individual grades
CREATE TABLE IF NOT EXISTS grades (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_app_id VARCHAR(100) NOT NULL,
  brightspace_id VARCHAR(100),
  category VARCHAR(255),
  name VARCHAR(255) NOT NULL,
  score DECIMAL(10,2),
  max_score DECIMAL(10,2) DEFAULT 100,
  date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Announcements / updates
CREATE TABLE IF NOT EXISTS announcements (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_app_id VARCHAR(100),
  title VARCHAR(500) NOT NULL,
  body TEXT,
  date DATE,
  type VARCHAR(50) DEFAULT 'announcement',
  urgency VARCHAR(20),
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Todos
CREATE TABLE IF NOT EXISTS todos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_app_id VARCHAR(100),
  task VARCHAR(500) NOT NULL,
  due DATE,
  done BOOLEAN DEFAULT FALSE,
  priority VARCHAR(20) DEFAULT 'medium',
  source VARCHAR(50) DEFAULT 'manual',  -- 'manual', 'brightspace', 'ai-announcement', 'ai-email'
  source_id VARCHAR(200),               -- unique ID from source (e.g. 'bs-assignment-12345') for dedup
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, source_id)
);

-- Notes
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_app_id VARCHAR(100),
  text TEXT NOT NULL,
  date TIMESTAMP DEFAULT NOW()
);

-- Study sessions
CREATE TABLE IF NOT EXISTS study_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_app_id VARCHAR(100),
  duration INTEGER,
  date TIMESTAMP DEFAULT NOW()
);

-- Streaks (one row per user)
CREATE TABLE IF NOT EXISTS streaks (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_completed DATE
);

-- Emails (cached from Microsoft Graph)
CREATE TABLE IF NOT EXISTS emails (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  course_app_id VARCHAR(100),
  subject VARCHAR(500),
  from_name VARCHAR(255),
  from_email VARCHAR(255),
  date DATE,
  preview TEXT,
  important BOOLEAN DEFAULT FALSE,
  microsoft_id VARCHAR(255),
  UNIQUE(user_id, microsoft_id)
);

-- Semester info (one per user)
CREATE TABLE IF NOT EXISTS semester_info (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100),
  start_date DATE,
  end_date DATE,
  holidays JSONB
);

-- Schedule (one per user)
CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  days JSONB NOT NULL
);

-- Automations
CREATE TABLE IF NOT EXISTS automations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255),
  description TEXT,
  schedule VARCHAR(255),
  last_run TIMESTAMP,
  status VARCHAR(50) DEFAULT 'active'
);

-- Session store (for connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
  "sid" VARCHAR NOT NULL COLLATE "default",
  "sess" JSON NOT NULL,
  "expire" TIMESTAMP(6) NOT NULL,
  PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
