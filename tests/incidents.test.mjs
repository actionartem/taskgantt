import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incidentDay, incidentDeadline, incidentInputTime, incidentInstant, incidentMonthDays, shiftIncidentMonth, compareIncidentCreation, compareArchivedIncidents } from '../lib/incidents.ts';

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

test('archive chronology uses source creation instants, with unknown dates last and stable ties', () => {
  const rows = [
    {id:'1',number:'999',itsm_created_at:null,created_at:'2027-01-01',closed_at:'2027-01-01'},
    {id:'2',number:'101',itsm_created_at:'2026-06-18T17:47:00+03:00',created_at:'2026-10-29',closed_at:'2026-10-29'},
    {id:'3',number:'102',itsm_created_at:'2026-10-20T14:00:00Z',created_at:'2026-10-01',closed_at:'2026-10-01'},
    {id:'4',number:'103',itsm_created_at:'2026-06-18T14:47:00Z',created_at:'2026-10-28',closed_at:'2026-10-28'},
    {id:'5',number:'998',itsm_created_at:'invalid',created_at:'2028-01-01',closed_at:'2028-01-01'},
    {id:'6',number:'100',itsm_created_at:'2025-12-31T23:59:00Z',created_at:'2026-10-30',closed_at:'2026-10-30'},
  ];
  assert.deepEqual([...rows].sort(compareIncidentCreation).map(row=>row.id),['3','4','2','6','1','5']);
  assert.equal(compareIncidentCreation(rows[0],rows[0]),0);
});

test('later closures are prepended above the initial archive, regardless of their ITSM creation dates or later edits', () => {
  const rows = [
    {id:'1',number:'100',archive_initial:true,itsm_created_at:'2026-06-18T14:47:00Z',closed_at:'2026-10-29T20:00:00Z'},
    {id:'2',number:'101',archive_initial:true,itsm_created_at:'2026-10-20T14:00:00Z',closed_at:'2026-10-29T19:00:00Z'},
    {id:'3',number:'99',archive_initial:false,itsm_created_at:'2020-01-01T00:00:00Z',closed_at:'2026-10-29T21:00:00Z',updated_at:'2026-11-01T00:00:00Z'},
    {id:'4',number:'98',archive_initial:false,itsm_created_at:null,closed_at:'2026-10-29T21:01:00Z',updated_at:'2026-10-29T21:01:00Z'},
  ];
  assert.deepEqual([...rows].sort(compareArchivedIncidents).map(row=>row.id),['4','3','2','1']);
});
