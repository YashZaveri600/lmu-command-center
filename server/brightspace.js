/**
 * Brightspace D2L Valence API wrapper
 *
 * Calls Brightspace REST endpoints using stored session cookies (bridge mode)
 * or OAuth2 tokens (when available).
 */

const BASE_URL = process.env.BRIGHTSPACE_BASE_URL || 'https://brightspace.lmu.edu'

// ─── API call helper ───
// cookie can be:
//   - a string like "d2lSessionVal=xxx; d2lSecureSessionVal=yyy" (raw cookie header)
//   - a JSON string like {"session":"xxx","secure":"yyy"}
//   - just the d2lSessionVal value (legacy)
async function bsFetch(path, cookie) {
  const url = `${BASE_URL}${path}`
  const headers = {}

  if (cookie) {
    // If it looks like a raw cookie header or already contains =
    if (cookie.includes('d2lSessionVal=') || cookie.includes('d2lSecureSessionVal=')) {
      headers['Cookie'] = cookie
    } else {
      // Try parsing as JSON
      try {
        const parsed = JSON.parse(cookie)
        let cookieStr = `d2lSessionVal=${parsed.session}`
        if (parsed.secure) cookieStr += `; d2lSecureSessionVal=${parsed.secure}`
        headers['Cookie'] = cookieStr
      } catch {
        // Fallback: just d2lSessionVal
        headers['Cookie'] = `d2lSessionVal=${cookie}`
      }
    }
  }

  const res = await fetch(url, { headers, redirect: 'manual' })

  // If redirected to login page, cookie is expired
  if (res.status === 302 || res.status === 303) {
    throw new Error('BRIGHTSPACE_SESSION_EXPIRED')
  }

  if (!res.ok) {
    throw new Error(`Brightspace API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

// ─── Get enrolled courses ───
export async function fetchEnrollments(cookie) {
  // Try multiple API versions until one works
  const apiVersions = ['1.47', '1.28', '1.0']
  let data = null
  let usedVersion = null

  for (const ver of apiVersions) {
    try {
      const url = `/d2l/api/lp/${ver}/enrollments/myenrollments/`
      console.log(`[brightspace] Trying enrollment API version ${ver}...`)
      data = await bsFetch(url, cookie)
      usedVersion = ver
      console.log(`[brightspace] Version ${ver} worked!`)
      break
    } catch (e) {
      console.log(`[brightspace] Version ${ver} failed: ${e.message}`)
    }
  }

  if (!data) {
    throw new Error('All enrollment API versions failed')
  }

  // Collect all items with pagination
  let allItems = data.Items || data.items || []
  console.log(`[brightspace] Got ${allItems.length} enrollment items (page 1), keys: ${Object.keys(data)}`)

  if (allItems.length > 0) {
    console.log(`[brightspace] Sample item:`, JSON.stringify(allItems[0]).slice(0, 300))
  }

  // Handle pagination
  let bookmark = data.PagingInfo?.HasMoreItems ? data.PagingInfo.Bookmark : null
  let attempts = 1

  while (bookmark && attempts < 10) {
    try {
      const pageData = await bsFetch(`/d2l/api/lp/${usedVersion}/enrollments/myenrollments/?bookmark=${bookmark}`, cookie)
      const pageItems = pageData.Items || pageData.items || []
      allItems = allItems.concat(pageItems)
      bookmark = pageData.PagingInfo?.HasMoreItems ? pageData.PagingInfo.Bookmark : null
      attempts++
      console.log(`[brightspace] Page ${attempts}: ${pageItems.length} items`)
    } catch {
      break
    }
  }

  console.log(`[brightspace] Total enrollment items: ${allItems.length}`)

  // Determine current semester name (e.g., "Spring 2026")
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-12
  let currentSemester
  if (month >= 1 && month <= 5) {
    currentSemester = `Spring ${year}`
  } else if (month >= 6 && month <= 7) {
    currentSemester = `Summer ${year}`
  } else {
    currentSemester = `Fall ${year}`
  }
  console.log(`[brightspace] Current semester: ${currentSemester}`)

  // Filter to current semester courses only
  const courses = allItems
    .filter(item => {
      if (!item.OrgUnit) return false
      const name = item.OrgUnit.Name || ''
      // Only include courses from the current semester
      return name.toLowerCase().includes(currentSemester.toLowerCase())
    })
    // Deduplicate by cleaned name (some courses have multiple sections like PHIL-1800-18 and PHIL-1800-18/20)
    .filter((item, idx, arr) => {
      const cleanName = item.OrgUnit.Name
        .replace(/^(Spring|Fall|Summer)\s+\d{4}\s+/i, '')
        .replace(/\s*\([^)]+\)\s*$/, '')
        .trim()
        .toLowerCase()
      return idx === arr.findIndex(i => {
        const otherClean = i.OrgUnit.Name
          .replace(/^(Spring|Fall|Summer)\s+\d{4}\s+/i, '')
          .replace(/\s*\([^)]+\)\s*$/, '')
          .trim()
          .toLowerCase()
        return otherClean === cleanName
      })
    })
    .map(item => ({
      brightspaceId: item.OrgUnit.Id,
      name: item.OrgUnit.Name,
      code: item.OrgUnit.Code || '',
    }))

  console.log(`[brightspace] Filtered to ${courses.length} courses:`, courses.map(c => `${c.name} (${c.brightspaceId})`))
  return courses
}

// ─── Get grades for a course ───
export async function fetchGrades(courseId, cookie) {
  const data = await bsFetch(`/d2l/api/le/1.0/${courseId}/grades/values/myGradeValues/`, cookie)
  return (data || []).map(g => {
    // Brightspace returns comments as { Html: "...", Text: "..." } objects.
    // Prefer HTML when present (it preserves basic formatting); fall back to Text.
    const commentsHtml = g.Comments?.Html || null
    const commentsText = g.Comments?.Text || null
    // Also check PrivateComments which some instructors use for feedback.
    const privateHtml = g.PrivateComments?.Html || null
    const privateText = g.PrivateComments?.Text || null
    // Choose the richest non-empty feedback we've got.
    let feedback = commentsHtml || privateHtml || commentsText || privateText || null
    if (feedback && typeof feedback === 'string' && !feedback.trim()) feedback = null

    return {
      id: g.GradeObjectIdentifier,
      name: g.GradeObjectName,
      type: g.GradeObjectTypeName,
      points: g.PointsNumerator,
      maxPoints: g.PointsDenominator,
      weight: g.WeightedNumerator,
      maxWeight: g.WeightedDenominator,
      date: g.LastModified || null,
      feedback,
    }
  })
}

// ─── Get grade categories/weights for a course ───
export async function fetchCategories(courseId, cookie) {
  try {
    const data = await bsFetch(`/d2l/api/le/1.0/${courseId}/grades/categories/`, cookie)
    return (data || []).map(cat => ({
      id: cat.Id,
      name: cat.Name,
      shortName: cat.ShortName,
      weight: cat.Weight?.Numerator || 0,
      maxPoints: cat.MaxPoints || null,
    }))
  } catch (e) {
    // Some courses don't have categories set up
    console.log(`[brightspace] No categories for course ${courseId}`)
    return []
  }
}

// ─── Get grade objects (for category mapping) ───
export async function fetchGradeObjects(courseId, cookie) {
  try {
    const data = await bsFetch(`/d2l/api/le/1.0/${courseId}/grades/`, cookie)
    return (data || []).map(obj => ({
      id: obj.Id,
      name: obj.Name,
      categoryId: obj.CategoryId || 0,
      maxPoints: obj.MaxPoints,
      weight: obj.Weight,
    }))
  } catch (e) {
    console.log(`[brightspace] No grade objects for course ${courseId}`)
    return []
  }
}

// ─── Get assignments (dropbox folders) for a course ───
export async function fetchAssignments(courseId, cookie) {
  try {
    const data = await bsFetch(`/d2l/api/le/1.0/${courseId}/dropbox/folders/`, cookie)
    return (data || []).map(folder => ({
      id: folder.Id,
      name: folder.Name,
      dueDate: folder.DueDate || null,
      endDate: folder.EndDate || null,
      instructions: folder.Instructions?.Html || folder.Instructions?.Text || '',
      isHidden: folder.IsHidden || false,
    }))
  } catch (e) {
    console.log(`[brightspace] No assignments/dropbox for course ${courseId}: ${e.message}`)
    return []
  }
}

// ─── Fetch rubrics attached to an assignment (dropbox folder) ───
// Returns a normalized array [{ id, name, description, criteria: [{ name, description, levels: [{ name, points, description }] }] }]
// Best-effort: returns [] on any error (most assignments don't have rubrics).
export async function fetchAssignmentRubrics(courseId, folderId, cookie) {
  try {
    const summaries = await bsFetch(`/d2l/api/le/1.0/${courseId}/dropbox/folders/${folderId}/rubrics/`, cookie)
    if (!Array.isArray(summaries) || summaries.length === 0) return []

    // Each rubric summary may already include Criteria+Levels in some Valence versions,
    // but most return just metadata so we fetch criteria separately for each rubric.
    const results = []
    for (const r of summaries) {
      const rubricId = r.Id ?? r.RubricId
      if (rubricId == null) continue
      let criteriaData = r.Criteria
      if (!Array.isArray(criteriaData)) {
        try {
          criteriaData = await bsFetch(`/d2l/api/lp/1.0/rubrics/${rubricId}/criteria/`, cookie)
        } catch {
          criteriaData = []
        }
      }

      const criteria = (Array.isArray(criteriaData) ? criteriaData : []).map(c => ({
        name: c.Name || c.CriterionName || 'Untitled criterion',
        description: c.Description?.Html || c.Description?.Text || '',
        levels: (Array.isArray(c.Levels) ? c.Levels : []).map(l => ({
          name: l.Name || l.LevelName || '',
          points: typeof l.Points === 'number' ? l.Points : (l.PointsNumerator ?? null),
          description: l.Description?.Html || l.Description?.Text || '',
        })),
      }))

      results.push({
        id: rubricId,
        name: r.Name || 'Rubric',
        description: r.Description?.Html || r.Description?.Text || '',
        criteria,
      })
    }
    return results
  } catch (e) {
    // 404 / no rubrics attached is common and expected
    return []
  }
}

// ─── Check my submissions for an assignment ───
// Brightspace returns a few different shapes depending on version + assignment
// type, so we check all of them before giving up:
//   1) Flat array of submission objects: [ { Id, SubmissionDate, ... } ]
//   2) Nested per-user form: [ { Entity: {...}, Submissions: [ {...} ] } ]
//   3) Plain empty array = truly not submitted
export async function fetchMySubmissions(courseId, folderId, cookie) {
  try {
    const data = await bsFetch(`/d2l/api/le/1.0/${courseId}/dropbox/folders/${folderId}/submissions/mysubmissions`, cookie)
    if (!Array.isArray(data) || data.length === 0) return false

    for (const entry of data) {
      if (!entry || typeof entry !== 'object') continue
      // Nested form: { Submissions: [...] }
      if (Array.isArray(entry.Submissions) && entry.Submissions.length > 0) return true
      // Flat form: the entry itself is a submission record
      if (entry.Id != null || entry.SubmissionId != null || entry.SubmissionDate) return true
      // Some versions: { Files: [...] }
      if (Array.isArray(entry.Files) && entry.Files.length > 0) return true
    }
    return false
  } catch (e) {
    // If endpoint doesn't exist or returns error, assume not submitted
    console.log(`[brightspace] submission check failed for folder ${folderId}: ${e.message}`)
    return false
  }
}

// ─── Get quizzes for a course ───
export async function fetchQuizzes(courseId, cookie) {
  try {
    const data = await bsFetch(`/d2l/api/le/1.0/${courseId}/quizzes/`, cookie)
    return (data || []).map(quiz => ({
      id: quiz.QuizId,
      name: quiz.Name,
      dueDate: quiz.DueDate || quiz.EndDate || null,
      instructions: quiz.Description?.Html || quiz.Description?.Text || '',
      isActive: quiz.IsActive,
    }))
  } catch (e) {
    console.log(`[brightspace] No quizzes for course ${courseId}: ${e.message}`)
    return []
  }
}

// ─── Get discussion forums and topics for a course ───
export async function fetchDiscussions(courseId, cookie) {
  try {
    const forums = await bsFetch(`/d2l/api/le/1.0/${courseId}/discussions/forums/`, cookie)
    const topics = []
    for (const forum of (forums || [])) {
      try {
        const forumTopics = await bsFetch(`/d2l/api/le/1.0/${courseId}/discussions/forums/${forum.ForumId}/topics/`, cookie)
        for (const topic of (forumTopics || [])) {
          if (topic.IsHidden) continue
          topics.push({
            id: topic.TopicId,
            forumId: forum.ForumId,
            name: topic.Name,
            dueDate: topic.EndDate || null,
            forumName: forum.Name,
          })
        }
      } catch (e) {
        // Some forums may not be accessible
      }
    }
    return topics
  } catch (e) {
    console.log(`[brightspace] No discussions for course ${courseId}: ${e.message}`)
    return []
  }
}

// ─── Check my posts in a discussion topic ───
export async function fetchMyDiscussionPosts(courseId, forumId, topicId, cookie) {
  try {
    const data = await bsFetch(`/d2l/api/le/1.0/${courseId}/discussions/forums/${forumId}/topics/${topicId}/posts/my`, cookie)
    return (data || []).length > 0
  } catch (e) {
    return false
  }
}

// ─── Check quiz attempts ───
export async function fetchQuizAttempts(courseId, quizId, cookie) {
  try {
    const data = await bsFetch(`/d2l/api/le/1.0/${courseId}/quizzes/${quizId}/attempts/`, cookie)
    return (data || []).length > 0
  } catch (e) {
    return false
  }
}

// ─── Get calendar events for a course ───
export async function fetchCalendarEvents(courseId, cookie) {
  try {
    const data = await bsFetch(`/d2l/api/le/1.0/${courseId}/calendar/events/`, cookie)
    return (data || []).map(ev => ({
      id: ev.CalendarEventId || ev.Id,
      title: ev.EventName || ev.Title || 'Untitled event',
      description: ev.Description?.Html || ev.Description?.Text || '',
      startDate: ev.StartDate || null,
      endDate: ev.EndDate || null,
      location: ev.Location || '',
      eventType: ev.EventType || 'calendar',
    }))
  } catch (e) {
    console.log(`[brightspace] No calendar events for course ${courseId}: ${e.message}`)
    return []
  }
}

// ─── Get course content modules (files, links, pages, videos) ───
// Walks the content tree and returns a flat list with parent references.
// Fetches sibling modules in parallel with a concurrency cap, bounded depth,
// and resilient to any individual API call failing.
export async function fetchCourseContent(courseId, cookie) {
  const BASE = 'https://brightspace.lmu.edu'
  const MAX_DEPTH = 8
  const CONCURRENCY = 4

  // Normalize Brightspace topic type codes to a small set we render icons for
  function classifyTopic(t) {
    const code = t.TypeIdentifier ?? t.Type
    const map = {
      0: 'file', 1: 'link', 2: 'page',
      3: 'dropbox', 4: 'quiz', 5: 'discussion',
      6: 'scorm', 7: 'checklist', 8: 'survey', 9: 'selfassess',
    }
    if (typeof code === 'number' && map[code]) return map[code]
    // Fall back to URL heuristics
    const url = t.Url || ''
    if (/\.pdf$/i.test(url)) return 'file'
    if (/quiz/i.test(url)) return 'quiz'
    if (/discussion/i.test(url)) return 'discussion'
    if (/dropbox/i.test(url)) return 'dropbox'
    return 'page'
  }

  // Normalize a child item into "module" or "topic" regardless of shape
  function isModule(obj) {
    // Modules expose ModuleId; topics expose TopicId. Prefer the presence check.
    if (obj == null) return false
    if (obj.TopicId !== undefined && obj.TopicId !== null) return false
    if (obj.ModuleId !== undefined && obj.ModuleId !== null) return true
    // Last resort: Type === 0 is "Module" in Brightspace Valence
    return obj.Type === 0
  }

  // Minimal concurrency limiter
  async function mapWithLimit(list, limit, fn) {
    const results = new Array(list.length)
    let idx = 0
    async function runner() {
      while (true) {
        const i = idx++
        if (i >= list.length) return
        try { results[i] = await fn(list[i], i) }
        catch (e) { results[i] = null }
      }
    }
    const runners = Array(Math.min(limit, list.length)).fill(0).map(runner)
    await Promise.all(runners)
    return results
  }

  const items = []
  let sortOrder = 0

  async function walk(module, parentBsId, depth) {
    if (depth > MAX_DEPTH) return
    const modId = module.ModuleId ?? module.Id
    if (modId == null) return
    const moduleBsId = `module-${modId}`

    items.push({
      bsId: moduleBsId,
      parentBsId: parentBsId || null,
      title: module.Title || 'Untitled Module',
      type: 'module',
      url: null,
      description: module.Description?.Html || module.Description?.Text || '',
      dueDate: module.ModuleDueDate || null,
      sortOrder: sortOrder++,
    })

    // Fetch this module's structure (direct children only)
    let structure
    try {
      structure = await bsFetch(`/d2l/api/le/1.0/${courseId}/content/modules/${modId}/structure/`, cookie)
    } catch (e) {
      console.log(`[brightspace] Skip module ${modId} for course ${courseId}: ${e.message}`)
      return
    }
    if (!Array.isArray(structure)) return

    // Add all topics first (preserve order)
    for (const child of structure) {
      if (isModule(child)) continue
      const topicId = child.TopicId ?? child.Id
      if (topicId == null) continue
      let url = child.Url || null
      // Any relative path on Brightspace should be prepended with the base.
      // Includes /d2l/..., /content/enforced/..., /le/..., etc.
      if (url && url.startsWith('/')) {
        url = `${BASE}${url}`
      }
      // D2L internal URI scheme (e.g. d2l:brightspace:content:...) — use the viewer URL instead
      if (url && url.startsWith('d2l:')) {
        url = `${BASE}/d2l/le/content/${courseId}/viewContent/${topicId}/View`
      }
      if (!url) url = `${BASE}/d2l/le/content/${courseId}/viewContent/${topicId}/View`
      items.push({
        bsId: `topic-${topicId}`,
        parentBsId: moduleBsId,
        title: child.Title || 'Untitled',
        type: classifyTopic(child),
        url,
        description: child.Description?.Html || child.Description?.Text || '',
        dueDate: child.DueDate || null,
        sortOrder: sortOrder++,
      })
    }

    // Recurse sub-modules in parallel with concurrency cap
    const submodules = structure.filter(isModule)
    if (submodules.length > 0) {
      await mapWithLimit(submodules, CONCURRENCY, sm => walk(sm, moduleBsId, depth + 1))
    }
  }

  try {
    const root = await bsFetch(`/d2l/api/le/1.0/${courseId}/content/root/`, cookie)
    if (!Array.isArray(root)) return []
    await mapWithLimit(root, CONCURRENCY, m => walk(m, null, 0))
    return items
  } catch (e) {
    console.error(`[brightspace] fetchCourseContent failed for course ${courseId}:`, e.message)
    return []
  }
}

// ─── Get announcements/news for a course ───
export async function fetchAnnouncements(courseId, cookie) {
  try {
    const data = await bsFetch(`/d2l/api/le/1.0/${courseId}/news/`, cookie)
    return (data || []).map(item => ({
      id: item.Id,
      title: item.Title,
      body: item.Body?.Html || item.Body?.Text || '',
      date: item.StartDate || item.CreatedDate,
      source_url: `https://brightspace.lmu.edu/d2l/le/news/${courseId}/${item.Id}/view`,
    }))
  } catch (e) {
    console.error(`[brightspace] Failed to fetch announcements for course ${courseId}:`, e.message)
    return []
  }
}

// ─── Get user info ───
export async function fetchWhoAmI(cookie) {
  try {
    const data = await bsFetch('/d2l/api/lp/1.0/users/whoami', cookie)
    return {
      userId: data.Identifier,
      firstName: data.FirstName,
      lastName: data.LastName,
      uniqueName: data.UniqueName,
    }
  } catch (e) {
    console.error('[brightspace] Failed to fetch user info:', e.message)
    return null
  }
}

export default {
  fetchEnrollments,
  fetchGrades,
  fetchCategories,
  fetchGradeObjects,
  fetchAssignments,
  fetchAssignmentRubrics,
  fetchMySubmissions,
  fetchQuizzes,
  fetchQuizAttempts,
  fetchDiscussions,
  fetchMyDiscussionPosts,
  fetchAnnouncements,
  fetchCourseContent,
  fetchCalendarEvents,
  fetchWhoAmI,
}
