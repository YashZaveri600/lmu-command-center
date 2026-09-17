// Prefer explicit term labels; use access dates for offerings without a term label.
export function selectCurrentEnrollments(items, now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const term = month <= 5 ? 'spring' : month <= 7 ? 'summer' : 'fall'
  const seen = new Set()
  return items.filter(item => {
    const unit = item.OrgUnit
    if (!unit?.Id || (unit.Type?.Id != null && unit.Type.Id !== 3)) return false
    if (item.Access?.IsActive === false) return false
    const label = `${unit.Name || ''} ${unit.Code || ''}`
    // Handle year-first labels separately to keep the capture order explicit.
    const forward = label.match(/\b(spring|summer|fall|autumn|winter)[\s_-]*(20\d{2})\b/i)
    const reverse = label.match(/\b(20\d{2})[\s_-]*(spring|summer|fall|autumn|winter)\b/i)
    const namedTerm = (forward?.[1] || reverse?.[2] || '').toLowerCase().replace('autumn', 'fall')
    const namedYear = Number(forward?.[2] || reverse?.[1])
    const start = Date.parse(item.Access?.StartDate)
    const end = Date.parse(item.Access?.EndDate)
    if (Number.isFinite(start) && start > now.getTime()) return false
    if (Number.isFinite(end) && end < now.getTime()) return false
    if (namedTerm) {
      if (namedTerm !== term || namedYear !== year) return false
    } else if (!Number.isFinite(start) || !Number.isFinite(end)) {
      // An active flag alone can remain set on old or non-semester courses.
      return false
    }
    if (seen.has(String(unit.Id))) return false
    seen.add(String(unit.Id))
    return true
  }).map(({ OrgUnit }) => ({
    brightspaceId: OrgUnit.Id, name: OrgUnit.Name, code: OrgUnit.Code || '',
  }))
}
