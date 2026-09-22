import test from 'node:test'
import assert from 'node:assert/strict'
import { dailyPlan, currentSemesterProgress } from './dailyPlan.js'
import { projectedGrade } from '../demo/data.js'
test('daily plan uses unfinished tasks and excludes past items from upcoming', () => {
  const plan = dailyPlan([{task:'done',due:'2026-09-22',done:true},{task:'today',due:'2026-09-22',done:false},{task:'late',due:'2026-09-21'},{task:'next',due:'2026-09-23'},{task:'later',due:'2026-10-01'},{task:'undated'}],new Date(2026,8,22))
  assert.deepEqual(plan.today.map(t=>t.task),['today'])
  assert.deepEqual(plan.overdue.map(t=>t.task),['late'])
  assert.deepEqual(plan.upcoming.map(t=>t.task),['next'])
  assert.equal(plan.pending.at(-1).task,'undated')
})
test('past, future, and invalid semesters do not display current progress', () => {
  const now=new Date(2026,8,22)
  assert.equal(currentSemesterProgress({startDate:'2026-01-01',endDate:'2026-05-15'},now),null)
  assert.equal(currentSemesterProgress({startDate:'2027-01-01',endDate:'2027-05-15'},now),null)
  assert.equal(currentSemesterProgress({startDate:'invalid',endDate:'invalid'},now),null)
  assert.ok(currentSemesterProgress({startDate:'2026-08-20',endDate:'2026-12-15'},now)>0)
})
test('grade explorer computes endpoints and weighted final contribution', () => {
  assert.equal(projectedGrade(80,25,100),85)
  assert.equal(projectedGrade(80,25,0),60)
  assert.equal(projectedGrade(80,0,0),80)
  assert.equal(projectedGrade(80,100,92),92)
  assert.equal(projectedGrade(NaN,25,100),null)
})
