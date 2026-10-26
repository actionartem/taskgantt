import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGanttCalendar } from '../lib/gantt-calendar.ts';
import { russianCalendarDay } from '../lib/russian-calendar.ts';
const day = value => Date.parse(value + 'T00:00:00Z') / 86400000;
test('calendar keeps real month widths, today marker and Russian holidays across a year boundary', () => {
  const calendar = buildGanttCalendar({ start: day('2025-12-29'), end: day('2026-02-28') }, 30, 'day', day('2026-01-05'), russianCalendarDay);
  assert.deepEqual(calendar.months.map(m => m.width), [90, 930, 840]);
  assert.equal(calendar.ticks.length, 62);
  assert.equal(calendar.ticks.find(t => t.today).title.slice(0, 10), '2026-01-05');
  assert.equal(calendar.ticks.find(t => t.title.startsWith('2026-01-05')).off, true);
  assert.equal(calendar.ticks.find(t => t.title.startsWith('2026-01-12')).off, false);
  assert.match(calendar.background, /var\(--st-weekend\)/);
});
test('monthly scale includes leap February, weeks start Monday, final holiday stripe is closed', () => {
  const range = { start: day('2024-01-01'), end: day('2024-03-31') };
  const monthly = buildGanttCalendar(range, 3, 'month', -1, russianCalendarDay);
  assert.deepEqual(monthly.ticks.map(t => t.width), [93, 87, 93]);
  const weekly = buildGanttCalendar(range, 9, 'week', -1, russianCalendarDay);
  assert.ok(weekly.ticks.every(t => new Date(t.title.slice(0,10)).getUTCDay() === 1));
  assert.match(weekly.background, /transparent 819px\)$/);
});
