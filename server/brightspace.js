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
  return (data || []).map(g => ({
    id: g.GradeObjectIdentifier,
    name: g.GradeObjectName,
    type: g.GradeObjectTypeName,
    points: g.PointsNumerator,
    maxPoints: g.PointsDenominator,
    weight: g.WeightedNumerator,
    maxWeight: g.WeightedDenominator,
    date: g.LastModified || null,
  }))
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

// ─── Get announcements/news for a course ───
export async function fetchAnnouncements(courseId, cookie) {
  try {
    const data = await bsFetch(`/d2l/api/le/1.0/${courseId}/news/`, cookie)
    return (data || []).map(item => ({
      id: item.Id,
      title: item.Title,
      body: item.Body?.Html || item.Body?.Text || '',
      date: item.StartDate || item.CreatedDate,
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
  fetchAnnouncements,
  fetchWhoAmI,
}
