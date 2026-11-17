// Автотести тренажера «Ліди» (ТЗ 004, етап D): сценарій за затвердженою редакцією, цілі, кроки поверх рушія C1,
// розбір за 8 критеріями, збереження кроку й злиття між пристроями, назви кабінету за v5, глосарій, звʼязка з гілкою товарки,
// цифри уроків L01–L05 і тренажера не збігаються, підсумок — одна операція з нагородою один раз.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADS, AD_FIELDS_UNVERIFIED, CRITERIA, GOALS, LEADS, LEVEL_ITEMS, SIM_KB, SIM_LEADS_ID, SIM_STEPS, VARIANTS } from '../../app-mvp/src/data/simLeads.ts';
import { gradeCriteria, leadsOk, levelsOk, mergeSimLeads, recordStep, SIM_FRESH } from '../../app-mvp/src/data/simLeadsRules.ts';
import { BRANCHES, unitById, volumeLabel, readyLessonIds } from '../../app-mvp/src/data/branches/index.ts';
import { branchReward, nextUnit } from '../../app-mvp/src/data/branchRules.ts';
import { applyOp, coreOf, mergeClientState, type Op } from '../../app-mvp/src/cloud/shared/progressOps.ts';
import { kbGet } from '../../app-mvp/src/data/kb.ts';
import { ADS_SIM_STEPS } from '../../app-mvp/src/data/adsSim.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
// glossary.ts імпортує модулі без розширень (Metro), тож у Node читаємо його як текст: id, match і привʼязку до статті
const GLOSS = fs.readFileSync(path.join(ROOT, 'app-mvp/src/data/glossary.ts'), 'utf8');
const term = (id: string) => {
  const line = GLOSS.split('\n').find((l) => l.includes(`{ id: '${id}',`));
  const m = line ? /match: '([^']*)'/.exec(line) : null;
  const a = new RegExp(`[ ,]${id}: '([A-Z]+-[0-9A-Z]+)'`).exec(GLOSS);
  // у джерелі рядок JS: «\\p» означає «\p» у регулярному виразі
  return m ? { match: m[1].split('\\\\').join('\\'), article: a?.[1] } : undefined;
};
const ids = SIM_STEPS.map((s) => s.id);
const at = (id: string) => ids.indexOf(id);

test('D1: сценарій іде за редакцією v5 — бриф → ціль → налаштування → зріз 3-го дня → зріла когорта → розбір → повтор з однією зміною', () => {
  const order = ['brief', 'terms', 'cpl', 'rule', 'goal', 'conversion', 'fields3', 'levels', 'ads', 'control', 'leadlist', 'wait', 'mature', 'next', 'variant', 'conclusion', 'review'];
  for (let i = 1; i < order.length; i++) assert.ok(at(order[i - 1]) >= 0 && at(order[i - 1]) < at(order[i]), `${order[i - 1]} → ${order[i]}`);
  assert.equal(new Set(ids).size, ids.length, 'ID кроків унікальні');
  assert.equal(SIM_STEPS[SIM_STEPS.length - 1].kind, 'review');
  // два зрізи показуються як таблиці звіту
  assert.ok(SIM_STEPS.some((s) => s.view?.includes('sliceD3')));
  assert.ok(SIM_STEPS.some((s) => s.view?.includes('sliceD6')));
  // повтор: три варіанти, результат за варіантом; основний — одна зміна (+₴330), альтернативний −₴150, «підняти бюджет» Гріндік зупиняє
  assert.deepEqual(VARIANTS.map((v) => v.id), ['A', 'B', 'C']);
  assert.equal(VARIANTS.filter((v) => v.good).map((v) => v.id).join(), 'A');
  assert.equal(VARIANTS[0].result, '+₴330');
  assert.equal(VARIANTS[1].result, '−₴150');
  assert.ok(!VARIANTS[2].rows && VARIANTS[2].grindyk);
});

test('D2: усі шість цілей відкривають пояснення; «Ліди» — повний цикл, «Продажі» — тільки пояснення', () => {
  assert.deepEqual(GOALS.map((g) => g.label), ['Упізнаваність', 'Трафік', 'Взаємодія', 'Ліди', 'Просування додатка', 'Продажі']);
  for (const g of GOALS) assert.ok(g.explain.length > 40, g.id);
  assert.deepEqual(GOALS.filter((g) => g.pick).map((g) => g.id), ['leads']);
  const sales = GOALS.find((g) => g.id === 'sales')!;
  assert.ok(sales.secondCase && !sales.pick);
  assert.ok(!/лише каталог|тільки каталог/.test(sales.explain) && /каталог для цього не обовʼязковий/.test(sales.explain));
});

test('D3: кроки поверх рушія C1 — число з допуском, три поля, рівні, оголошення й лендинг, таблиці, список заявок, варіант повтору', () => {
  const st = (id: string) => SIM_STEPS[at(id)];
  const q = (id: string) => (st(id) as { step: { type: string } }).step;
  assert.equal(q('cpl').type, 'numeric');
  const f3 = q('fields3') as unknown as { type: string; slots: { label: string }[] };
  assert.equal(f3.type, 'bundle');
  assert.deepEqual(f3.slots.map((s) => s.label), ['Ціль кампанії', 'Сигнал для системи', 'Результат за договором']);
  assert.equal(st('levels').kind, 'levels');
  assert.ok(st('ads').view?.includes('ads') && st('ads').view?.includes('landing'));
  assert.equal(st('leadlist').kind, 'leadList');
  assert.equal(st('variant').kind, 'variant');
  // числові відповіді з допуском
  for (const s of SIM_STEPS) if (s.kind === 'step' && s.step.type === 'numeric') for (const f of s.step.fields) assert.ok(typeof f.tolerance === 'number', `${s.id}: ${f.label}`);
});

test('D3: рівні кабінету — «Кампанії» → «Набори реклами» → «Реклама»; перевірка розставлення', () => {
  const right = LEVEL_ITEMS.map((i) => i.level);
  assert.equal(levelsOk(LEVEL_ITEMS, right), true);
  assert.equal(levelsOk(LEVEL_ITEMS, right.map((l, i) => (i === 1 ? 'ad' : l))), false);
  assert.equal(LEVEL_ITEMS.find((i) => i.label === 'Ціль кампанії')?.level, 'campaign');
  assert.equal(LEVEL_ITEMS.find((i) => i.label === 'Аудиторія')?.level, 'adset');
  assert.equal(LEVEL_ITEMS.find((i) => i.label === '«Рекламні матеріали»')?.level, 'ad');
});

test('D3: список заявок — 30 у кабінеті, 28 у CRM; зайві: контрольна й повторна відправка з того ж номера', () => {
  assert.equal(LEADS.length, 30);
  assert.equal(LEADS.filter((r) => r.crm).length, 28);
  const extra = LEADS.map((r, i) => (r.extra ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(extra.map((i) => LEADS[i].extra).sort(), ['control', 'resubmit']);
  const re = extra.find((i) => LEADS[i].extra === 'resubmit')!;
  assert.equal(LEADS[re].phone, LEADS[re - 1].phone, 'повтор із того ж номера');
  assert.equal(leadsOk(LEADS, extra), true);
  assert.equal(leadsOk(LEADS, [extra[0]]), false);
  assert.equal(leadsOk(LEADS, [...extra, 5]), false);
  // час іде по порядку (знайдено в браузері: було 09:00 → 16:13 → 11:26)
  const key = (t: string) => t.replace('д', '').replace(' ', '').replace(':', '');
  for (let i = 1; i < LEADS.length; i++) assert.ok(key(LEADS[i - 1].t) <= key(LEADS[i].t), `${LEADS[i - 1].t} → ${LEADS[i].t}`);
});

test('D4: макети трьох оголошень і лендингу; поля тексту оголошення — нейтральні підписи з позначкою unverified', () => {
  assert.equal(ADS.length, 3);
  assert.equal(AD_FIELDS_UNVERIFIED, true);
  const src = fs.readFileSync(path.join(ROOT, 'app-mvp/src/data/simLeads.ts'), 'utf8');
  for (const s of ['Текст оголошення', 'Заголовок', 'Опис', 'Кнопка']) assert.ok(src.includes(`'${s}'`), s);
  assert.ok(ADS[0].primary.includes('безкоштовно') && ADS[2].primary.includes('Лікарі радять'));
});

test('D5: назви кабінету за v5 — «Набір реклами», «Просування додатка», пояснення «Продажі» без «лише каталог»', () => {
  const files = ['app-mvp/src/data/adsSim.ts', 'app-mvp/src/data/bm/adsmanager.ts', 'app-mvp/src/data/glossary.ts', 'app-mvp/src/data/adsManagerTour.ts', 'app-mvp/src/data/advisor.ts', 'app-mvp/src/data/simLeads.ts'];
  for (const f of files) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\[Гг\]руп\\\\p\{L\}\*\\\\s\+оголошень/g, '');
    assert.ok(!/[Гг]руп\p{L}*\s+оголошень/u.test(s), `${f}: «група оголошень»`);
    assert.ok(!/Просування додатку|Просування додатків/.test(s), `${f}: «Просування додатку»`);
    assert.ok(!/оптимізують покупки в каталозі/.test(s), `${f}: старе пояснення «Продажі»`);
  }
  assert.ok(ADS_SIM_STEPS.some((s) => s.options.some((o) => o.label === 'Просування додатка')));
});

test('D6: глосарій — валідна заявка, когорта, холд, капа, недозвон зі статтями «Бази» (спільні ID етапу B)', () => {
  const want: Record<string, string> = { 'валідних заявок': 'valid_lead', когорти: 'cohort', холд: 'hold', капа: 'cap', недозвон: 'no_answer' };
  for (const [word, id] of Object.entries(want)) {
    const t = term(id);
    assert.ok(t, id);
    assert.ok(new RegExp(`^(?:${t!.match})$`, 'u').test(word), `${id} ловить «${word}»`);
    assert.ok(t!.article && kbGet(t!.article, 'uk'), `${id} → стаття`);
  }
  assert.ok(new RegExp(`^(?:${term('adset')!.match})$`, 'u').test('Набір реклами'));
});

test('D7: розбір — 8 критеріїв v5 на наявних кроках; невиконаний критерій веде на крок для повтору; ваги балів для ліги немає', () => {
  assert.deepEqual(CRITERIA.map((c) => c.n), [1, 2, 3, 4, 5, 6, 7, 8]);
  for (const c of CRITERIA) for (const id of c.steps) assert.ok(at(id) >= 0, `${c.n}: ${id}`);
  const all = Object.fromEntries(CRITERIA.flatMap((c) => c.steps).map((id) => [id, true]));
  assert.ok(gradeCriteria(CRITERIA, all).every((g) => g.ok));
  const g = gradeCriteria(CRITERIA, { ...all, wait: false });
  assert.equal(g.find((x) => x.n === 5)?.ok, false);
  assert.equal(g.find((x) => x.n === 5)?.retry, 'wait');
  assert.ok(!JSON.stringify(CRITERIA).match(/points|бал(?!анс)/i));
  for (const k of SIM_KB) assert.ok(kbGet(k, 'uk'), k);
});

test('D8: тренажер — фінал товарки; цифри уроків L01–L05 і тренажера не збігаються (за даними)', () => {
  const tov = BRANCHES[0];
  assert.equal(tov.final?.id, SIM_LEADS_ID);
  assert.equal(tov.final?.sim, 'leads');
  assert.equal(unitById(SIM_LEADS_ID)?.kind, 'final');
  assert.equal(volumeLabel(tov), 'Вступ · Самоперевірка · 5 уроків · Фінал');
  assert.equal(nextUnit('TOV', ['BR-TOV-PR'], { sc: 'pass', practice: 'pass' }, readyLessonIds(tov), true), SIM_LEADS_ID);
  // числові відповіді
  const lessonNums = new Set<number>();
  for (const u of [...tov.lessons, tov.practice, { steps: tov.selfcheck }]) for (const s of u.steps) if (s.type === 'numeric') for (const f of s.fields) lessonNums.add(f.answer);
  const simNums = new Set<number>();
  for (const s of SIM_STEPS) if (s.kind === 'step' && s.step.type === 'numeric') for (const f of s.step.fields) simNums.add(f.answer);
  assert.deepEqual([...lessonNums].filter((n) => simNums.has(n)), []);
  // суми в гривнях у текстах
  const money = (s: string) => new Set((s.match(/[₴]\s?\d[\d\s]*(?:,\d+)?/g) ?? []).map((x) => x.replace(/\s/g, '')));
  const lessonsMoney = money(JSON.stringify([tov.lessons, tov.practice, tov.selfcheck]));
  const simMoney = money(JSON.stringify(SIM_STEPS) + JSON.stringify(VARIANTS));
  assert.deepEqual([...lessonsMoney].filter((m) => simMoney.has(m)), []);
});

test('D9: крок і відповіді зберігаються; перша спроба фіксується один раз; злиття між пристроями не відкочує завершення', () => {
  let s = recordStep(SIM_FRESH, 'cpl', false, 10);
  assert.equal(s.isFirst, true);
  s = recordStep({ ...s.state, step: 3 }, 'cpl', true, 20);
  assert.equal(s.isFirst, false);
  assert.equal(s.state.first.cpl, false, 'перша спроба лишається');
  assert.equal(s.state.res.cpl, true, 'останній результат оновлено');
  assert.equal(s.state.step, 3);

  const phone = { ...SIM_FRESH, step: 9, at: 200, first: { cpl: true }, res: { cpl: true } };
  const desktop = { ...SIM_FRESH, step: 4, at: 100, done: true, seen: ['sales'] };
  const m = mergeSimLeads(phone, desktop);
  assert.equal(m.step, 9, 'новіший крок');
  assert.equal(m.done, true, 'завершення не відкочується');
  assert.deepEqual(m.seen, ['sales']);
  // у клієнтському знімку (конфлікт) — те саме правило
  const out = mergeClientState({ simLeads: desktop }, { simLeads: phone }) as { simLeads: typeof phone };
  assert.equal(out.simLeads.step, 9);
  assert.equal(mergeSimLeads(undefined, undefined).step, 0);
});

test('D9: підсумок — операція lesson BR-TOV-FINAL; нагорода один раз, повтор без нагороди', () => {
  const base = { coins: 64, xp: 74 };
  assert.deepEqual(branchReward({ kind: 'final', passed: true, alreadyDone: false, base }), { ...base, complete: true });
  assert.deepEqual(branchReward({ kind: 'final', passed: true, alreadyDone: true, base }), { coins: 0, xp: 0, complete: true });
  const op = (n: number, xp: number): Op => ({ opId: `sim-${n}`, kind: 'lesson', at: n, lessonId: SIM_LEADS_ID, xp, coins: 10 });
  let r = applyOp(coreOf({}), [], op(1, 74));
  r = applyOp(r.core, r.rewarded, op(2, 74));
  assert.equal(r.core.xp, 74, 'друге проходження не нараховує');
  assert.ok(r.core.completed.includes(SIM_LEADS_ID));
  for (const id of readyLessonIds(BRANCHES[0])) assert.ok(!r.core.completed.includes(id), 'тренажер не позначає уроки');
});
