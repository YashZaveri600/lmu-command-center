# EduSync

**Less catching up. More moving forward.** An independent student dashboard built by Yash Zaveri.

[Visit the website](https://lmu-command-center-production.up.railway.app/?welcome=1) · [Try the interactive demo](https://lmu-command-center-production.up.railway.app/?demo=1)

## Product idea

Students find deadlines, course files, and grades in different places. EduSync brings those pieces into a daily plan. The product is positioned around clarity and the next useful action, rather than a long list of integrations.

The public demo makes the core idea accessible without a university account. Visitors can complete assignments, search and filter tasks, browse fictional courses, and explore a weighted final-grade scenario. All demo data is fictional, held in memory, and reset on reload. It does not call the student API or an AI provider.

## What is implemented

- A responsive public landing page, product story, FAQ, and interactive demo.
- Microsoft sign-in and separate student accounts backed by PostgreSQL.
- Brightspace imports for course files, grades, announcements, and assignments using a user-supplied session.
- AI syllabus analysis and briefings through Anthropic, with a task-based briefing fallback.
- Enrollment selection by term labels or bounded access dates; reconnect messages for rejected sessions.

## Current limits

This is an independent personal project, not a university-endorsed service. Brightspace cookies expire and must be refreshed; official Brightspace OAuth is not implemented. Course permissions can limit imports. AI availability depends on credentials, provider availability, and credits. Calculated grades are estimates and may not represent every instructor's grading rules. Live fall-semester imports still need verification with a fresh student connection.

No adoption, time-saved, or learning-outcome metrics are claimed. Useful future validation would measure successful first sync, ability to find the next assignment, and repeat use; those measurements are not implemented in this version.

## Run locally

Requires Node.js 22 and npm. For the public site and demo only:

```sh
npm ci
npm run dev
```

Open the displayed local URL with `?welcome=1` or `?demo=1`. These routes do not require a backend.

For the connected student app, configure the server's database and Microsoft OAuth environment variables locally, then run `npm run dev:full`. Never commit `.env` or session cookies. The signed-in app requires PostgreSQL and registered Microsoft redirect URLs.

```sh
npm run build
node --test server/enrollments.test.js src/utils/dailyPlan.test.js
```

## Architecture

React and Vite render the public site and app. Public, demo, and authenticated views load separately. The Express backend handles Microsoft authentication, Brightspace synchronization, AI requests, and server-sent updates. PostgreSQL stores account-specific data. Railway deploys the application from GitHub `main`.

Relevant student content is sent to Anthropic when AI features run. The public demo contains no real student records.
