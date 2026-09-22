// Fictional, browser-only examples. Never derived from a student's account.
export const demoCourses = [
  { id: 'brand', code: 'MKTG 310', name: 'Brand Strategy', color: '#e77551', credits: 3, professor: 'Dr. Jordan Lee', room: 'Business Hall · 204', time: 'Mon / Wed · 10:00 AM', completed: 91, finalWeight: 30 },
  { id: 'consumer', code: 'MKTG 320', name: 'Consumer Behavior', color: '#a599d3', credits: 3, professor: 'Dr. Avery Chen', room: 'Business Hall · 112', time: 'Tue / Thu · 11:30 AM', completed: 88, finalWeight: 25 },
  { id: 'analytics', code: 'BUS 240', name: 'Marketing Analytics', color: '#74a99a', credits: 3, professor: 'Dr. Morgan Ellis', room: 'Analytics Lab · 08', time: 'Mon / Wed · 1:00 PM', completed: 94, finalWeight: 35 },
  { id: 'writing', code: 'COMM 210', name: 'Persuasive Writing', color: '#d4ac58', credits: 3, professor: 'Dr. Taylor Rivera', room: 'Arts Building · 303', time: 'Tue / Thu · 2:00 PM', completed: 89, finalWeight: 20 },
]
export const initialTasks = [
  { id: 1, course: 'brand', title: 'Finish the brand positioning brief', detail: 'Define the audience, promise, and reasons to believe for your chosen brand.', offset: 0, priority: 'High', done: false },
  { id: 2, course: 'analytics', title: 'Review campaign performance data', detail: 'Compare conversion rates across the three sample acquisition channels.', offset: 1, priority: 'High', done: false },
  { id: 3, course: 'consumer', title: 'Map the customer decision journey', detail: 'Bring one example of a purchase influenced by social proof.', offset: 2, priority: 'Medium', done: false },
  { id: 4, course: 'writing', title: 'Draft a landing page headline', detail: 'Write three headlines, each with a distinct customer benefit.', offset: 3, priority: 'Medium', done: false },
  { id: 5, course: 'brand', title: 'Read the brand architecture case', detail: 'Prepare two questions for the seminar discussion.', offset: -1, priority: 'Low', done: true },
]
export const demoAnnouncements = [
  { course: 'brand', title: 'Your brief checklist is ready', body: 'Include one audience insight and a clear point of difference.', when: 'Today' },
  { course: 'analytics', title: 'Campaign dataset posted', body: 'The practice dataset is ready for this week’s channel analysis.', when: 'Yesterday' },
]
export function projectedGrade(completed, finalWeight, finalScore) {
  if (![completed, finalWeight, finalScore].every(Number.isFinite) || finalWeight < 0 || finalWeight > 100) return null
  return completed * (1 - finalWeight / 100) + finalScore * finalWeight / 100
}
