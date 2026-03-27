/**
 * Brightspace D2L Valence API wrapper
 *
 * Calls Brightspace REST endpoints using stored session cookies (bridge mode)
 * or OAuth2 tokens (when available).
 */

const BASE_URL = process.env.BRIGHTSPACE_BASE_URL || 'https://brightspace.lmu.edu'

// ─── API call helper ───
async function bsFetch(path, cookie) {
  const url = `${BASE_URL}${path}`
  const headers = {}

  if (cookie) {
    headers['Cookie'] = `d2lSessionVal=${cookie}`
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
  const data = await bsFetch('/d2l/api/lp/1.0/enrollments/myenrollments/?sortBy=name', cookie)
  // Filter to active courses (not withdrawn, has a valid OrgUnitId)
  const courses = (data.Items || [])
    .filter(item => item.OrgUnit && item.OrgUnit.Type?.Id === 3) // Type 3 = course offering
    .map(item => ({
      brightspaceId: item.OrgUnit.Id,
      name: item.OrgUnit.Name,
      code: item.OrgUnit.Code,
    }))
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
