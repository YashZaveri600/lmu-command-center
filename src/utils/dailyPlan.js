export function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
}
export function dailyPlan(todos = [], now = new Date()) {
  const today = localDateKey(now)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate()+7)
  const last = localDateKey(end)
  const pending = todos.filter(t=>!t.done).slice().sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'))
  const date = t => (t.due || '').slice(0,10)
  return { pending, today: pending.filter(t=>date(t)===today), overdue: pending.filter(t=>date(t)&&date(t)<today), upcoming: pending.filter(t=>date(t)>today&&date(t)<last) }
}
export function currentSemesterProgress(semester, now = new Date()) {
  if (!semester?.startDate || !semester?.endDate) return null
  const start = new Date(`${semester.startDate.slice(0,10)}T00:00:00`)
  const end = new Date(`${semester.endDate.slice(0,10)}T23:59:59`)
  if (!Number.isFinite(+start) || !Number.isFinite(+end) || end<=start || now<start || now>end) return null
  return ((now-start)/(end-start))*100
}
