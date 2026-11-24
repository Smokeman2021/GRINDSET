// Автотести підсумків мініаналітики. Запуск: node --test supabase/tests/*.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeEvents } from '../../app-mvp/src/cloud/shared/analytics.ts';

const ev = (name: string, username: string, props: Record<string, unknown> | null = null) => ({ name, username, props });

test('підсумок: користувачі, сесії, воронка по уроках', () => {
  const s = summarizeEvents([
    ev('session_start', 'a'),
    ev('session_start', 'b'),
    ev('lesson_start', 'a', { lesson: 'l2' }),
    ev('lesson_complete', 'a', { lesson: 'l2' }),
    ev('lesson_start', 'b', { lesson: 'l2' }),
    ev('lesson_exit', 'b', { lesson: 'l2', step: 2, total: 6 }),
    ev('lesson_start', 'b', { lesson: 'l3' }),
  ]);
  assert.equal(s.users, 2);
  assert.equal(s.sessions, 2);
  assert.deepEqual(s.lessons[0], { lesson: 'l2', starts: 2, completes: 1, exits: 1, completion: 50, avgExitStep: 3 });
  assert.equal(s.lessons[1].lesson, 'l3');
  assert.equal(s.lessons[1].completion, 0);
});

test('події без lesson ігноруються у воронці; порожній ввід не ламає', () => {
  assert.deepEqual(summarizeEvents([]), { events: 0, users: 0, sessions: 0, lessons: [] });
  assert.equal(summarizeEvents([ev('lesson_start', 'a', null)]).lessons.length, 0);
});

test('завершень не більше, ніж стартів (повтор після перезапуску не дає >100%)', () => {
  const s = summarizeEvents([ev('lesson_start', 'a', { lesson: 'x' }), ev('lesson_complete', 'a', { lesson: 'x' }), ev('lesson_complete', 'a', { lesson: 'x' })]);
  assert.equal(s.lessons[0].completion, 100);
});
