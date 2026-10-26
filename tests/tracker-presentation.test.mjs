import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inHoursPeriod, nextAction, simpleHistory } from '../lib/tracker-presentation.ts';

test('all-time hours includes undated tasks while calendar years stay strict', () => {
  const dates = ['2025-12-31', '2026-01-01', '2026-12-31', '2027-01-01', null];
  assert.deepEqual(dates.filter(date => inHoursPeriod(date, 'all')), dates);
  assert.deepEqual(dates.filter(date => inHoursPeriod(date, '2026')), ['2026-01-01', '2026-12-31']);
});

test('simple history keeps only real status and assignee changes, newest first', () => {
  const event = (id, changes, extra = {}) => ({ id, source: 'simpletracker', type: 'task.updated', occurred_at: `2026-10-2${id}T10:00:00Z`, received_at: '2026-10-27T10:00:00Z', changes, ...extra });
  const input = [
    event('1', { status: { old: null, new: 'в аналитике' }, title: { old: null, new: 'Задача' } }),
    event('2', {}, { type: 'document.approved', summary: 'Документ согласован' }),
    event('3', { status: { old: 'в аналитике', new: 'в аналитике' }, due_at: { old: null, new: '2026-11-01' } }),
    event('4', { assignee_user_id: { old: '1', new: '2' }, title: { old: 'Старое', new: 'Новое' } }),
    event('5', { assignee: { old: 'Маша', new: 'Иван' }, status: { old: 'Open', new: 'In progress' } }, { source: 'jira', occurred_at: null }),
  ];
  const output = simpleHistory(input);
  assert.deepEqual(output.map(e => e.id), ['5', '4', '1']);
  assert.deepEqual(Object.keys(output[1].changes), ['assignee_user_id']);
  assert.deepEqual(Object.keys(output[2].changes), ['status']);
  assert.equal(output[0].source, 'jira');
  assert.equal(output[0].occurred_at, null, 'do not invent the time of an observed Jira change');
  assert.ok(input[0].changes.title, 'filtering must not mutate stored events');
});

test('automatic action follows status, with specific agent instructions taking priority', () => {
  assert.equal(nextAction({ status: 'разработка' }), 'Завершить разработку');
  assert.equal(nextAction({ status: 'на согласовании', waitingFor: 'ДИТ' }), 'Получить согласование · ДИТ');
  assert.equal(nextAction({ status: 'на согласовании', nextActionText: '  Запросить ответ по документу  ' }), 'Запросить ответ по документу');
  assert.equal(nextAction({ status: 'завершена', nextActionText: 'Старое действие' }), null);
});
