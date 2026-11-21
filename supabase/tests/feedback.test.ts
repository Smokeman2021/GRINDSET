// Автотести відгуків на клієнті (ТЗ 004, E2): контекст підставляється автоматично, черга експортується в Markdown,
// старий формат для сервера до 0008, зведення внеску, кнопка відгуку на кожному екрані (статично по маршрутах).
// Права доступу (тестер не читає чужих відгуків, поміток і зведення) — supabase/sqltest/feedback.test.ts на локальному Postgres.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contextLine, contributors, feedbackContext, kindLabel, legacyPayload, queueMarkdown, type QueueRow } from '../../app-mvp/src/cloud/shared/feedbackQueue.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const APP = path.join(ROOT, 'app-mvp', 'app');

test('E2: контекст — збірка, екран, гілка (з ID уроку), урок, крок, крок тренажера; тестер нічого не вводить', () => {
  assert.deepEqual(feedbackContext({ screen: 'lesson', lessonId: 'BR-GAM-L03', stepIdx: 2 }, 26), { build: 26, screen: 'lesson', lessonId: 'BR-GAM-L03', stepIdx: 2, branch: 'GAM' });
  assert.deepEqual(feedbackContext({ screen: 'leads', lessonId: 'BR-TOV-FINAL', branch: 'TOV', simStep: 13 }, 26), { build: 26, screen: 'leads', lessonId: 'BR-TOV-FINAL', branch: 'TOV', simStep: 13 });
  assert.deepEqual(feedbackContext({ screen: 'kb/ECO-01' }, 26), { build: 26, screen: 'kb/ECO-01' });
  assert.equal(contextLine({ build: 26, screen: 'leads', branch: 'TOV', lessonId: 'BR-TOV-FINAL', simStep: 13 }), 'b26 · leads · гілка TOV · урок BR-TOV-FINAL · тренажер, крок 14');
});

test('E2: види — коментар, пропозиція, баг; старий «idea» показується як пропозиція', () => {
  assert.deepEqual(['comment', 'proposal', 'bug', 'idea'].map(kindLabel), ['Коментар', 'Пропозиція', 'Баг', 'Пропозиція']);
});

test('E2: сервер до 0008 (вікно викладки) — запис старим форматом, вид і контекст не губляться', () => {
  const ctx = feedbackContext({ screen: 'leads', branch: 'TOV', simStep: 4 }, 26);
  assert.deepEqual(legacyPayload('comment', 'Дрібний шрифт', ctx), { kind: 'idea', body: '[коментар] Дрібний шрифт (гілка TOV, тренажер, крок 5)' });
  assert.equal(legacyPayload('bug', 'x', feedbackContext({ screen: 'home' }, 26)).kind, 'bug');
});

const row = (o: Partial<QueueRow>): QueueRow => ({ id: 1, username: 't', kind: 'bug', screen: 'home', lessonId: '', stepIdx: null, body: 'b', build: 26, createdAt: Date.UTC(2026, 10, 18, 10), status: 'new', useful: false, ...o });

test('E2: експорт черги в Markdown — лише «в черзі для Claude», з контекстом і поміткою власника', () => {
  const md = queueMarkdown(
    [
      row({ id: 7, status: 'queued', kind: 'bug', username: 'tester_two', screen: 'lesson', lessonId: 'BR-SRV-L02', stepIdx: 1, body: 'Кнопка не тиснеться\nна iOS', note: 'Відтворив', useful: true }),
      row({ id: 8, status: 'new', body: 'не в черзі' }),
      row({ id: 9, status: 'done', body: 'зроблено' }),
    ],
    new Date(Date.UTC(2026, 10, 18, 12))
  );
  assert.ok(md.startsWith('# Черга відгуків для Claude'));
  assert.ok(md.includes('у черзі: 1'));
  assert.ok(md.includes('🐞 Баг · #7 · ⭐ корисний'));
  assert.ok(md.includes('**Контекст:** b26 · lesson · гілка SRV · урок BR-SRV-L02 · крок 2'));
  assert.ok(md.includes('**Помітка власника:** Відтворив'));
  assert.ok(md.includes('> Кнопка не тиснеться\n> на iOS'));
  assert.ok(!md.includes('не в черзі') && !md.includes('зроблено'));
  assert.ok(queueMarkdown([]).includes('Черга порожня.'));
});

test('E2: зведення внеску — число відгуків і корисних на тестера', () => {
  const c = contributors([row({ username: 'a', useful: true }), row({ username: 'a' }), row({ username: 'b' })]);
  assert.deepEqual(c.map((x) => [x.username, x.total, x.useful]), [['a', 2, 1], ['b', 1, 0]]);
});

test('E2: кнопка відгуку на кожному екрані — власна 🐞 у шапці або плаваюча з кореневого layout', () => {
  const layout = fs.readFileSync(path.join(APP, '_layout.tsx'), 'utf8');
  const routes = [...layout.matchAll(/^ {2}'([^']+)',$/gm)].map((m) => m[1]);
  assert.ok(routes.includes('leads') && routes.includes('map/[code]'));
  const own = [...(/const OWN_FEEDBACK = \[([^\]]+)\]/.exec(layout)?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.ok(layout.includes('<GlobalFeedback />'), 'плаваюча кнопка в layout');
  // екрани з власною кнопкою справді мають форму відгуку
  const files: Record<string, string> = { '/lesson/': 'lesson/[id].tsx', '/branch/': 'branch/[code].tsx', '/map/': 'map/[code].tsx', '/leads': 'leads.tsx', '/profile': '(tabs)/profile.tsx' };
  for (const p of own.filter((x) => x !== '/login')) assert.ok(fs.readFileSync(path.join(APP, files[p]), 'utf8').includes('<FeedbackSheet'), `${p}: своя форма`);
  // форма передає ID одиниці й крок там, де вони є
  assert.ok(fs.readFileSync(path.join(APP, 'lesson/[id].tsx'), 'utf8').includes("context={{ screen: 'lesson', lessonId: id, stepIdx: idx }}"));
  assert.ok(fs.readFileSync(path.join(APP, 'leads.tsx'), 'utf8').includes("simStep: idx"));
});
