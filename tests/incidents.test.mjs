import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incidentDay, incidentDeadline, incidentInputTime, incidentInstant, incidentMonthDays, shiftIncidentMonth } from '../lib/incidents.ts';

test('incident deadlines use Moscow days across UTC midnight and preserve original expiry', () => {
  const item = { expires_at: '2026-10-29T20:59:00Z', is_deferred: true, deferred_until: '2026-10-29T21:01:00Z' };
  assert.equal(incidentDay(item.expires_at), '2026-10-29');
  assert.equal(incidentDay(incidentDeadline(item)), '2026-10-30');
  assert.equal(incidentInputTime(item.deferred_until), '2026-10-30T00:01');
  assert.equal(incidentInstant('2026-10-30T00:01'), item.deferred_until.replace('00Z', '00.000Z'));
  assert.equal(incidentDeadline({ ...item, is_deferred: false }), item.expires_at);
});
test('incident month starts Monday and includes leap days and year boundaries', () => {
  const feb = incidentMonthDays('2028-02');
  assert.equal(feb.length, 42);
  assert.equal(feb[0], '2028-01-31');
  assert.ok(feb.includes('2028-02-29'));
  assert.equal(new Date(`${feb[0]}T00:00:00Z`).getUTCDay(), 1);
  assert.equal(shiftIncidentMonth('2026-12', 1), '2027-01');
  assert.equal(shiftIncidentMonth('2027-01', -1), '2026-12');
});
