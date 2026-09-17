import test from 'node:test'
import assert from 'node:assert/strict'
import { selectCurrentEnrollments } from './enrollments.js'
import { fetchEnrollments } from './brightspace.js'

const now = new Date('2026-09-17T12:00:00')
const course = (id, name, access = {}, code = '') => ({
  OrgUnit: { Id: id, Name: name, Code: code, Type: { Id: 3 } }, Access: access,
})
test('selects current term variants without merging same-name offerings', () => {
  const rows = [course(1, 'Fall 2026 Accounting'), course(2, '2026-Fall Accounting'),
    course(3, 'Autumn_2026 Economics'), course(4, 'Spring 2026 Accounting'),
    course(5, 'Fall 2025 Accounting'), course(6, 'Accounting', {}, 'Fall_2026'),
    course(1, 'Fall 2026 Accounting')]
  assert.deepEqual(selectCurrentEnrollments(rows, now).map(c => c.brightspaceId), [1, 2, 3, 6])
})
test('uses bounded access dates for unnamed terms and excludes inaccessible offerings', () => {
  const active = { StartDate: '2026-08-20', EndDate: '2026-12-20', IsActive: true }
  const rows = [course(1, 'Accounting', active), course(2, 'Old course', { IsActive: true }),
    course(3, 'Fall 2026 Course', { ...active, IsActive: false }),
    course(4, 'Fall 2026 Course', { EndDate: '2026-09-01' }),
    course(5, 'Spring 2026 Course', active),
    { OrgUnit: { Id: 6, Name: 'Fall 2026', Type: { Id: 1 } } }]
  assert.deepEqual(selectCurrentEnrollments(rows, now).map(c => c.brightspaceId), [1])
})
test('rejected enrollment credentials produce a reconnect signal', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response('', { status: 403, statusText: 'Forbidden' })
  try { await assert.rejects(fetchEnrollments('test-cookie'), /BRIGHTSPACE_RECONNECT_REQUIRED/) }
  finally { globalThis.fetch = original }
})
test('login redirects preserve the expired-session signal', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response('', { status: 302 })
  try { await assert.rejects(fetchEnrollments('test-cookie'), /BRIGHTSPACE_SESSION_EXPIRED/) }
  finally { globalThis.fetch = original }
})
test('a failed enrollment page never returns a partial course list for cleanup', async () => {
  const original = globalThis.fetch
  let calls = 0
  globalThis.fetch = async () => ++calls === 1
    ? Response.json({ Items: [course(1, 'Fall 2026 Course')], PagingInfo: { HasMoreItems: true, Bookmark: 'next' } })
    : new Response('', { status: 500 })
  try { await assert.rejects(fetchEnrollments('test-cookie'), /500/) }
  finally { globalThis.fetch = original }
})
