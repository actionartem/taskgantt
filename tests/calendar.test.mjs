import { test } from 'node:test';
import assert from 'node:assert/strict';
import { russianCalendarDay } from '../lib/russian-calendar.ts';
test('official federal holiday and transfer dates, including working Saturdays', () => {
  for (const d of ['2025-05-08','2025-11-03','2026-01-09','2026-03-09','2026-05-11','2026-11-04','2026-12-31','2027-02-22','2027-11-05']) assert.equal(russianCalendarDay(d).off, true, d);
  for (const d of ['2024-04-27','2024-11-02','2024-12-28','2025-11-01','2027-02-20','2026-11-03']) assert.equal(russianCalendarDay(d).off, false, d);
});
test('each verified calendar has the correct annual working-day count', () => {
  for (const [year, expected] of [[2024,248],[2025,247],[2026,247],[2027,247]]) {
    let working = 0;
    for(let date = new Date(`${year}-01-01T00:00:00Z`);date.getUTCFullYear() === year;date.setUTCDate(date.getUTCDate()+1)) working += Number(!russianCalendarDay(date.toISOString().slice(0,10)).off);
    assert.equal(working, expected, String(year));
  }
});
test('unsupported years explicitly lack confirmed transfers', () => {
  assert.equal(russianCalendarDay('2028-01-01').confirmed, false);
});
