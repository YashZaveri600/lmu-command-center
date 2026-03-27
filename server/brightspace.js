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
  // Try multiple API versions and pagination
  let allItems = []
  let bookmark = null
  let attempts = 0

  do {
    const url = bookmark
      ? `/d2l/api/lp/1.0/enrollments/myenrollments/?sortBy=name&bookmark=${bookmark}`
      : '/d2l/api/lp/1.0/enrollments/myenrollments/?sortBy=name'

    const data = await bsFetch(url, cookie)
    console.log(`[brightspace] Enrollment response keys:`, Object.keys(data || {}))

    const items = data.Items || data.items || []
    console.log(`[brightspace] Got ${items.length} enrollment items (page ${attempts + 1})`)

    if (items.length > 0) {
      console.log(`[brightspace] Sample item keys:`, Object.keys(items[0]))
      if (items[0].OrgUnit) console.log(`[brightspace] OrgUnit sample:`, JSON.stringify(items[0].OrgUnit).slice(0, 200))
    }

    allItems = allItems.concat(items)

    // Handle pagination
    bookmark = data.PagingInfo?.HasMoreItems ? data.PagingInfo.Bookmark : null
    attempts++
  } while (bookmark && attempts < 10)

  console.log(`[brightspace] Total enrollment items: ${allItems.length}`)

  // Filter to courses - be lenient with the type filter
  const courses = allItems
    .filter(item => {
      if (!item.OrgUnit) return false
      // Accept Type.Id 3 (course offering) or any item with a course-like code
      const typeId = item.OrgUnit.Type?.Id
      const code = item.OrgUnit.Code || ''
      const name = item.OrgUnit.Name || ''
      // Include if it's type 3, or has a course code pattern, or name contains course indicators
      return typeId === 3 || /^[A-Z]{2,4}[.-]\d{4}/i.test(code) || /spring|fall|summer/i.test(name)
    })
    .map(item => ({
      brightspaceId: item.OrgUnit.Id,
      name: item.OrgUnit.Name,
      code: item.OrgUnit.Code || '',
    }))

  console.log(`[brightspace] Filtered to ${courses.length} courses:`, courses.map(c => c.name))
  return courses
}

// ─── Get grades for a course ───
export async function fetchGrades(courseId, cookie) {
  try {
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
  } catch (e) {
    console.error(`[brightspace] Failed to fetch grades for course ${courseId}:`, e.message)
    return []
  }
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
