// Автотести гілок (ТЗ 004, C1): чотири правила нагород, практика й самоперевірка не позначають уроки, фінал (рішення/дані/крок,
// блок «запускати» без допуску), злиття прогресу гілок між пристроями, дані восьми гілок, старий курс поза імпортами.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { branchReward, finalOpen, gradeFinal, lessonIds, nextUnit, unitKind, branchCrowns, lessonsWord } from '../../app-mvp/src/data/branchRules.ts';
import { BRANCHES, unitById, volumeLabel, questionSteps, readyLessonIds } from '../../app-mvp/src/data/branches/index.ts';
import { applyOp, coreOf, mergeClientState, replay, type Op } from '../../app-mvp/src/cloud/shared/progressOps.ts';
import { kbGet } from '../../app-mvp/src/data/kb.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const base = { coins: 35, xp: 19 };
const lessonOp = (id: string, xp: number, coins: number, n = 1): Op => ({ opId: `t-${id}-${n}`, kind: 'lesson', at: 1, lessonId: id, xp, coins });

test('правило 1: запис, де не відрізнити пропуск від проходження (уже в completed), — 0 XP і 0 монет', () => {
  assert.deepEqual(branchReward({ kind: 'lesson', passed: true, alreadyDone: true, base }), { coins: 0, xp: 0, complete: true });
  // сервер: урок у completed через skip (без rewarded) — клієнт шле 0, тож нарахування 0
  let s = applyOp(coreOf({}), [], { opId: 's', kind: 'skip', at: 1, lessons: ['BR-SRV-L01'] });
  s = applyOp(s.core, s.rewarded, lessonOp('BR-SRV-L01', 0, 0));
  assert.equal(s.core.xp, 0);
  assert.equal(s.core.coins, 0);
});

test('правило 2: самоперевірка, практика й пропуск не позначають уроки завершеними й не дають нагороди за урок', () => {
  assert.deepEqual(branchReward({ kind: 'selfcheck', passed: true, alreadyDone: false, base }), { coins: 0, xp: 0, complete: false });
  // практика — окрема одиниця: її зарахування не додає жодного уроку гілки в completed
  const r = replay(coreOf({}), [], [lessonOp('BR-TOV-PR', 19, 35)]);
  for (const id of lessonIds('TOV')) assert.ok(!r.core.completed.includes(id), id);
  assert.ok(r.core.completed.includes('BR-TOV-PR'));
  // але відкриває фінал (зарахована практика після самоперевірки)
  assert.equal(finalOpen('SRV', [], { sc: 'pass', practice: 'pass' }), true);
  assert.equal(finalOpen('SRV', [], { sc: 'pass' }), false);
  assert.equal(finalOpen('SRV', lessonIds('SRV'), undefined), true);
  // невдала практика — без нагороди
  assert.deepEqual(branchReward({ kind: 'practice', passed: false, alreadyDone: false, base }), { coins: 0, xp: 0, complete: false });
  assert.equal(unitKind('BR-TOV-SC'), 'selfcheck');
});

test('правило 3: перше реальне проходження уроку, практики, фіналу — повна нагорода один раз', () => {
  for (const kind of ['lesson', 'practice', 'final'] as const) assert.deepEqual(branchReward({ kind, passed: true, alreadyDone: false, base }), { ...base, complete: true });
  const r = replay(coreOf({}), [], [lessonOp('BR-SRV-FINAL', 70, 60), lessonOp('BR-SRV-FINAL', 70, 60, 2)]);
  assert.equal(r.core.xp, 70);
  assert.equal(r.core.coins, 60);
});

test('правило 4: свідомий повтор — 0 XP і 0 монет (і на клієнті, і на сервері)', () => {
  assert.deepEqual(branchReward({ kind: 'lesson', passed: true, alreadyDone: true, base }), { coins: 0, xp: 0, complete: true });
  assert.deepEqual(branchReward({ kind: 'final', passed: true, alreadyDone: true, base }), { coins: 0, xp: 0, complete: true });
  const first = applyOp(coreOf({}), [], lessonOp('BR-INF-L02', 19, 35));
  const again = applyOp(first.core, first.rewarded, lessonOp('BR-INF-L02', 19, 35, 2));
  assert.equal(again.status, 'already_rewarded');
  assert.equal(again.core.xp, 19);
});

test('фінал: рішення, дані й наступний крок оцінюються окремо; «запускати» без допуску блокує зарахування', () => {
  const steps = [
    { type: 'teach' },
    { type: 'choice', part: 'decision' as const, blockLaunch: [2], explain: 'рішення', see: 'BR-GAM-L01' },
    { type: 'numeric', part: 'data' as const, explain: 'дані', see: 'BR-GAM-L03' },
    { type: 'choice', part: 'next' as const, explain: 'крок', see: 'BR-GAM-L05' },
  ];
  assert.deepEqual(gradeFinal(steps, () => true, { 1: 0 }), { passed: true, gaps: [], blocked: false });
  const g = gradeFinal(steps, (i) => i !== 2, { 1: 0 });
  assert.equal(g.passed, false);
  assert.deepEqual(g.gaps.map((x) => [x.part, x.see]), [['data', 'BR-GAM-L03']]);
  const b = gradeFinal(steps, (i) => i !== 1, { 1: 2 });
  assert.equal(b.blocked, true);
  assert.equal(b.passed, false);
});

test('злиття прогресу гілок між пристроями: «pass» самоперевірки й практики не відкочується', () => {
  const out = mergeClientState({ branchProg: { TOV: { sc: 'fail', scSee: 'BR-TOV-L02' } } }, { branchProg: { TOV: { sc: 'pass', practice: 'pass' }, SRV: { started: true } } });
  const bp = out.branchProg as Record<string, Record<string, unknown>>;
  assert.equal(bp.TOV.sc, 'pass');
  assert.equal(bp.TOV.practice, 'pass');
  assert.equal(bp.SRV.started, true);
});

test('вісім гілок у порядку ТЗ; позначка обсягу фактична; регульовані позначені', () => {
  assert.deepEqual(BRANCHES.map((b) => b.code), ['TOV', 'SRV', 'INF', 'NUT', 'DAT', 'GAM', 'CRY', 'ADT']);
  assert.deepEqual(BRANCHES.filter((b) => b.regulated).map((b) => b.code), ['NUT', 'DAT', 'GAM', 'CRY', 'ADT']);
  for (const b of BRANCHES) {
    const n = readyLessonIds(b).length;
    const label = volumeLabel(b);
    assert.ok(label.startsWith('Вступ · Самоперевірка'), label);
    if (n === 5 && b.final?.ready) assert.equal(label, 'Вступ · Самоперевірка · 5 уроків · Фінал');
    if (n === 0) assert.ok(!/урок/.test(label), `${b.code}: уроків ще немає, а позначка ${label}`);
    assert.ok(!/скоро/i.test(JSON.stringify(b)), `${b.code}: «скоро»`);
  }
  assert.equal(lessonsWord(5), '5 уроків');
  assert.equal(lessonsWord(2), '2 уроки');
});

test('самоперевірка: 2 завдання з перевіркою (3–4 варіанти або число з допуском), розбір веде на наявний урок гілки', () => {
  for (const b of BRANCHES) {
    assert.equal(b.selfcheck.length, 2, b.code);
    for (const s of b.selfcheck) {
      if (s.type === 'choice') assert.ok(s.options.length >= 3 && s.options.length <= 4, `${b.code}: ${s.q}`);
      else if (s.type === 'numeric') assert.ok(s.fields.every((f) => typeof f.tolerance === 'number'), b.code);
      else assert.fail(`${b.code}: форма ${s.type}`);
      assert.ok(s.see && b.lessons.some((l) => l.id === s.see), `${b.code}: see ${s.see}`);
      assert.ok((s as { explain?: string }).explain, `${b.code}: немає розбору`);
    }
  }
});

test('практика: одне коротке завдання на нові цифри; помилка веде в урок навички; посилання «Бази» існують', () => {
  for (const b of BRANCHES) {
    const p = unitById(`BR-${b.code}-PR`);
    assert.ok(p && p.kind === 'practice' && p.unit.ready, b.code);
    const qs = questionSteps(p.unit);
    assert.ok(qs.length >= 1 && qs.length <= 3, b.code);
    for (const q of qs) assert.ok(q.see && b.lessons.some((l) => l.id === q.see), `${b.code}: see`);
    // практика не повторює питань самоперевірки
    for (const q of qs) assert.ok(!b.selfcheck.some((s) => s.q === q.q), `${b.code}: дубль самоперевірки`);
    for (const u of [p.unit, ...b.lessons, ...(b.final ? [b.final] : [])]) for (const id of u.kb) assert.ok(kbGet(id, 'uk'), `${u.id} → ${id}`);
    assert.ok(kbGet(b.kbCard, 'uk'), b.kbCard);
  }
});

test('товарка не дублює цифри кейсу «Ліди» (₴180, 30/28, 6/8/14, −₴48, +₴330) в уроках; фінал товарки — тренажер «Ліди»', () => {
  const tov = JSON.stringify([BRANCHES[0].lessons, BRANCHES[0].practice, BRANCHES[0].selfcheck]);
  for (const s of ['₴180', '180 ×', '30 відправлень', '28 прийнят', '−₴48', '+₴330', '₴6 на прийняту']) assert.ok(!tov.includes(s), s);
  // етап D: фінал — тренажер на власному екрані (дані й перевірки — simLeads.test.ts)
  assert.equal(BRANCHES[0].final?.sim, 'leads');
  assert.equal(nextUnit('TOV', ['BR-TOV-PR'], { practice: 'pass' }, [], false), null);
});

test('корони аватара рахуються з гілок, без контрольних старого курсу', () => {
  assert.equal(branchCrowns([], ['TOV']), 0);
  assert.equal(branchCrowns(['BR-TOV-PR'], ['TOV']), 1);
  assert.equal(branchCrowns(['BR-SRV-PR', 'BR-SRV-FINAL', ...lessonIds('INF')], ['SRV', 'INF']), 3);
});

// C2: уроки й фінали у формах з перевіркою
test('C2: кожен готовий урок — бриф, перевірювані кроки з еталоном, підказка Гріндіка, формулювання 023 для звіту', () => {
  for (const b of BRANCHES) for (const l of b.lessons.filter((x) => x.ready)) {
    assert.equal(l.steps[0].type, 'teach', `${l.id}: перший крок — бриф`);
    const qs = questionSteps(l);
    assert.ok(qs.length >= 1 && qs.length <= 4, l.id);
    for (const q of qs) assert.ok((q as { explain?: string }).explain, `${l.id}: еталон`);
    assert.ok(qs.some((q) => q.hint), `${l.id}: підказка Гріндіка`);
    assert.ok(qs[0].src, `${l.id}: src 023`);
    assert.ok(l.kb.length >= 1, `${l.id}: «База»`);
  }
});

test('C2: фінал перевіряє рішення, дані й наступний крок; у регульованих «запускати» блокує зарахування', () => {
  for (const b of BRANCHES) {
    if (!b.final || b.final.sim) continue; // фінал товарки — тренажер «Ліди» (етап D), свої автотести
    const qs = questionSteps(b.final);
    for (const p of ['decision', 'data', 'next']) assert.ok(qs.some((q) => q.part === p), `${b.code}: немає частини ${p}`);
    for (const q of qs) assert.ok(q.part && q.see && b.lessons.some((l) => l.id === q.see), `${b.code}: частина без уроку для повтору`);
    const dec = qs.filter((q) => q.part === 'decision');
    if (b.regulated) assert.ok(dec.some((q) => (q.blockLaunch ?? []).length > 0), `${b.code}: блок «запускати»`);
    // правильний варіант ніколи не позначений як блокуючий
    for (const q of dec) if (q.type === 'choice') assert.ok(!(q.blockLaunch ?? []).includes(q.answer), b.code);
  }
});

test('C2: жодних способів обходу модерації ні в текстах, ні в неправильних варіантах', () => {
  const all = JSON.stringify(BRANCHES).toLowerCase();
  for (const s of ['обійти', 'обхід модерац', 'клоак', 'cloak', 'фарм', 'авторег', 'інший акаунт', 'інший домен', 'антидетект']) assert.ok(!all.includes(s), s);
});

// C1.0: старий курс (модулі 01–10) прибрано з інтерфейсу; файли лишаються без змін і в бандл не імпортуються
const OLD = ['lessons', 'modules', 'content', 'module02', 'virtual', 'plan'];
test('старий курс не імпортується жодним екраном (лише import type)', () => {
  const offenders: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (!['generated', 'generated-public', 'node_modules'].includes(e.name)) walk(p);
        continue;
      }
      if (!/\.tsx?$/.test(e.name)) continue;
      const rel = path.relative(path.join(ROOT, 'app-mvp'), p).replace(/\\/g, '/');
      // StopScene (сцена закладу) з ТЗ 006 використовується гілками: сам він курсу не імпортує (лише import type JStop) — тож його імпорти теж перевіряються
      if (OLD.some((o) => rel === `src/data/${o}.ts`) || /^src\/art\/(Journey|JourneyMap|stops)\./.test(rel)) continue;
      for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
        if (/^import\s+type\b/.test(line)) continue;
        const m = /from\s+'([^']+)'/.exec(line);
        if (m && OLD.some((o) => new RegExp(`(^|/)data/${o}$|^\\./${o}$`).test(m[1]))) offenders.push(`${rel}: ${m[1]}`);
        if (m && /art\/(Journey|JourneyMap|stops)$|^\.\/(Journey|JourneyMap|stops)$/.test(m[1])) offenders.push(`${rel}: ${m[1]}`);
      }
    }
  };
  walk(path.join(ROOT, 'app-mvp', 'app'));
  walk(path.join(ROOT, 'app-mvp', 'src'));
  assert.deepEqual(offenders, []);
});

test('точність: відповіді всіх одиниць гілок ідуть у answersTotal/answersCorrect (rated)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'app-mvp', 'app', 'lesson', '[id].tsx'), 'utf8');
  assert.ok(src.includes('recordAnswers(resultsRef.current, { rated: true })'));
  assert.ok(!/weekXp|leaguePoints/.test(fs.readFileSync(path.join(ROOT, 'app-mvp', 'src', 'data', 'branchRules.ts'), 'utf8')));
});
