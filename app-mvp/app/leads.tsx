// Тренажер «Ліди» — фінал товарки (ТЗ 004, етап D). Сценарій — docs/CASE-TOVARKA-LEADS-APPROVED.md, дані — src/data/simLeads.ts.
// Крок і відповіді зберігаються на пристрої та в клієнтському знімку: після закриття тренажер відкривається на тому ж кроці.
// Підсумок — операція lesson BR-TOV-FINAL (через екран результату); повтор без нагороди.
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ENERGY_PER_LESSON, useStore } from '../src/store';
import { Theme, useStyles, useTheme } from '../src/theme';
import { Button } from '../src/components/Button';
import { Markdown } from '../src/components/Markdown';
import { GrindykSay } from '../src/components/GrindykSay';
import { FeedbackSheet } from '../src/components/FeedbackSheet';
import { Watermark } from '../src/components/Watermark';
import { CLOUD_MODE } from '../src/cloud/config';
import { track } from '../src/cloud/analytics';
import { playSfx } from '../src/sound';
import { haptic } from '../src/telegram/webapp';
import { scaleCoins } from '../src/economy';
import { shuffleQuestion } from '../src/data/shuffle';
import { branchReward } from '../src/data/branchRules';
import { gradeCriteria, recordStep, SIM_FRESH } from '../src/data/simLeadsRules';
import { ADS, AD1_FIXED, CRITERIA, LANDING, REASONS, SIM_KB, SIM_LEADS_ID, SIM_STEPS, SLICE_D3, SLICE_D6, VARIANTS, type SimView } from '../src/data/simLeads';
import { kbGet } from '../src/data/kb';
import { BundleStep, MatchStep, MultiStep, NumericStep, type Resolution } from '../src/components/steps';
import { AdCard, GoalsStep, Kicker, LandingMock, LeadListStep, LevelsStep, MdBox, ReportTable, UnverifiedNote, VariantStep } from '../src/components/simLeads';
import type { BStep } from '../src/data/branch';

const HUB = '/branch/TOV';

export default function LeadsSim() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sim = useStore((s) => s.simLeads) ?? SIM_FRESH;
  const completed = useStore((s) => s.completed);
  const alreadyDone = completed.includes(SIM_LEADS_ID);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const idx = Math.min(Math.max(0, sim.step), SIM_STEPS.length - 1);
  const cur = SIM_STEPS[idx];
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <Pressable
          onPress={() => {
            track('lesson_exit', { lesson: SIM_LEADS_ID, step: idx, total: SIM_STEPS.length });
            router.dismissTo(HUB);
          }}
          accessibilityLabel="До гілки"
        >
          <Text style={styles.x}>✕</Text>
        </Pressable>
        <View style={styles.pbar}>
          <View style={[styles.fill, { width: `${Math.round((idx / (SIM_STEPS.length - 1)) * 100)}%` }]} />
        </View>
        {CLOUD_MODE !== 'off' && (
          <Pressable onPress={() => setFeedbackOpen(true)} hitSlop={8} accessibilityLabel="Відгук">
            <Text style={{ fontSize: 18, opacity: 0.75 }}>🐞</Text>
          </Pressable>
        )}
      </View>
      <Text style={[styles.mode, { color: C.goldTxt }]}>
        🏁 ФІНАЛ ТОВАРКИ · ТРЕНАЖЕР «ЛІДИ»{alreadyDone ? ' · повторення без нагороди' : ''}
      </Text>
      <Text style={styles.stage}>
        {cur.kind === 'review' ? 'Розбір' : `Крок ${idx + 1} з ${SIM_STEPS.length - 1} · ${cur.stage}`}
      </Text>
      {cur.kind === 'review' ? (
        <Review key="review" alreadyDone={alreadyDone} />
      ) : (
        <StepView key={cur.id + ':' + idx} idx={idx} />
      )}
      <FeedbackSheet visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} context={{ screen: 'leads', lessonId: SIM_LEADS_ID, branch: 'TOV', simStep: idx }} />
      <Watermark />
    </View>
  );
}

// ───────── Один крок ─────────
function StepView({ idx }: { idx: number }) {
    const C = useTheme();
    const styles = useStyles(makeStyles);
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const setSim = useStore((x) => x.setSimLeads);
    const s = SIM_STEPS[idx];
    const st = useStore((x) => x.simLeads) ?? SIM_FRESH;
    const recordAnswers = useStore((x) => x.recordAnswers);
    const [res, setRes] = useState<Resolution>(null);
    const [sel, setSel] = useState<number | null>(null);
    const [picked, setPicked] = useState(false); // ціль / варіант повтору обрано
    const q: BStep | null = useMemo(() => (s.kind === 'step' && s.step.type !== 'teach' ? (shuffleQuestion(s.step as never) as BStep) : s.kind === 'step' ? s.step : null), [s]);
    const isTeach = s.kind === 'step' && s.step.type === 'teach';

    const resolve = (ok: boolean) => {
      if (res) return;
      const { state, isFirst } = recordStep(useStore.getState().simLeads ?? SIM_FRESH, s.id, ok, Date.now());
      setSim(state);
      if (isFirst) recordAnswers([{ lessonId: SIM_LEADS_ID, idx, ok }], { rated: true });
      setRes({ correct: ok });
      playSfx(ok ? 'correct' : 'wrong');
      if (ok) haptic.success();
      else haptic.error();
    };
    const go = () => {
      const now = useStore.getState().simLeads ?? SIM_FRESH;
      const reviewIdx = SIM_STEPS.length - 1;
      const step = now.back ? reviewIdx : idx + 1;
      setSim({ ...now, step, back: false, at: Date.now() });
      // «Продовжити» (етап E): крок тренажера
      useStore.getState().setPlace({ kind: 'sim', id: SIM_LEADS_ID, step, total: SIM_STEPS.length, title: 'Товарка · Тренажер «Ліди»', at: Date.now() }, 'TOV');
    };
    const canGo = isTeach || res !== null || picked;
    const isChoice = q?.type === 'choice';

    return (
      <>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          {s.grindyk && <GrindykSay text={s.grindyk} pose={idx === 0 ? "wave" : "point"} height={90} />}
          {(s.view ?? []).map((v) => (
            <ViewBlock key={v} v={v} />
          ))}
          {isTeach && q?.type === 'teach' ? (
            <>
              <Text style={styles.title}>{q.title}</Text>
              <Markdown text={q.body} />
            </>
          ) : null}
          {s.kind !== 'step' || !isTeach ? <Text style={styles.q}>{s.kind === 'step' ? (q as { q: string }).q : 'q' in s ? s.q : ''}</Text> : null}

          {isChoice && q.type === 'choice' && (
            <View>
              {q.options.map((o, k) => {
                const ok = res && k === q.answer;
                const bad = res && k === sel && k !== q.answer;
                return (
                  <Pressable
                    key={k}
                    disabled={!!res}
                    onPress={() => setSel(k)}
                    style={({ pressed }) => [styles.opt, !res && sel === k && styles.optPicked, ok && styles.optOk, bad && styles.optNo, pressed && !res && styles.optPressed]}
                  >
                    <Text style={styles.optTxt}>{o}</Text>
                  </Pressable>
                );
              })}
              {!res && <Button title="Перевірити" disabled={sel === null} onPress={() => resolve(sel === q.answer)} />}
            </View>
          )}
          {q?.type === 'multi' && <MultiStep step={q} resolution={res} onResolve={resolve} />}
          {q?.type === 'numeric' && <NumericStep step={q} resolution={res} onResolve={resolve} />}
          {q?.type === 'match' && <MatchStep step={q} resolution={res} onResolve={resolve} />}
          {q?.type === 'bundle' && <BundleStep step={q} resolution={res} onResolve={resolve} hint="Обери по одному варіанту в кожному полі" />}
          {s.kind === 'goals' && (
            <GoalsStep
              seen={st.seen}
              onSeen={(id) => {
                const now = useStore.getState().simLeads ?? SIM_FRESH;
                if (!now.seen.includes(id)) setSim({ ...now, seen: [...now.seen, id], at: Date.now() });
              }}
              onPick={go}
            />
          )}
          {s.kind === 'levels' && <LevelsStep resolution={res} onResolve={resolve} />}
          {s.kind === 'leadList' && <LeadListStep resolution={res} onResolve={resolve} />}
          {s.kind === 'variant' && (
            <VariantStep
              seen={st.variants}
              onPick={(v) => {
                const now = useStore.getState().simLeads ?? SIM_FRESH;
                // перший вибір іде в точність; далі можна подивитися інші варіанти
                const first = recordStep(now, s.id, v.good, Date.now());
                setSim({ ...first.state, variants: now.variants.includes(v.id) ? now.variants : [...now.variants, v.id] });
                if (first.isFirst) recordAnswers([{ lessonId: SIM_LEADS_ID, idx, ok: v.good }], { rated: true });
                setPicked(true);
              }}
            />
          )}

          {res && (
            <View style={[styles.fb, res.correct ? styles.fbOk : styles.fbNo]}>
              <Text style={[styles.fbTxt, { color: res.correct ? C.accentTxt : C.redTxt }]}>{res.correct ? 'Вірно.' : 'Не зовсім.'}</Text>
              {(q as { explain?: string } | null)?.explain || ('explain' in s && s.explain) ? (
                <Text style={styles.explain}>Еталон: {(q as { explain?: string } | null)?.explain ?? ('explain' in s ? s.explain : '')}</Text>
              ) : null}
              {!res.correct && s.grindykWrong && <Text style={styles.explain}>🦝 {s.grindykWrong}</Text>}
              {s.grindykAfter && <Text style={styles.explain}>🦝 {s.grindykAfter}</Text>}
            </View>
          )}
          {s.kb?.length && (res || isTeach) ? (
            <View style={styles.kbRow}>
              {s.kb.filter((k) => kbGet(k, 'uk')).map((k) => (
                <Pressable key={k} onPress={() => router.push(`/kb/${k}`)} style={styles.kbChip}>
                  <Text style={styles.kbChipTxt}>📘 {kbGet(k, 'uk')?.title ?? k}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </ScrollView>
        {s.kind !== 'goals' && (
          <View style={{ paddingTop: 10, paddingBottom: insets.bottom + 12 }}>
            <Button title={st.back && res ? 'До розбору' : isTeach ? 'Почати' : 'Далі'} disabled={!canGo} onPress={go} />
          </View>
        )}
      </>
    );
  }

// ───────── Розбір: 8 критеріїв ─────────
function Review({ alreadyDone }: { alreadyDone: boolean }) {
    const C = useTheme();
    const styles = useStyles(makeStyles);
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const setSim = useStore((x) => x.setSimLeads);
    const st = useStore((x) => x.simLeads) ?? SIM_FRESH;
    const grades = gradeCriteria(CRITERIA, st.res);
    const firsts = Object.values(st.first);
    const correct = firsts.filter(Boolean).length;
    const errors = firsts.length - correct;
    const finish = () => {
      const s = useStore.getState();
      const r = branchReward({ kind: 'final', passed: true, alreadyDone, base: { coins: 40 + correct * 3, xp: 50 + correct * 2 } });
      s.spendEnergy(ENERGY_PER_LESSON);
      s.setBranchProg('TOV', { started: true });
      setSim({ ...st, done: true, at: Date.now() });
      s.setPlace(null, 'TOV');
      track('lesson_complete', { lesson: SIM_LEADS_ID, correct, errors });
      router.replace({
        pathname: '/results',
        params: { id: SIM_LEADS_ID, correct: String(correct), errors: String(errors), maxBonus: '0', coins: String(scaleCoins(r.coins)), xp: String(r.xp), practice: alreadyDone ? '1' : '0', checkpoint: '0', passed: '1', speed: '0', doubled: '0' },
      });
    };
    const again = () => setSim({ ...SIM_FRESH, done: st.done, at: Date.now() });
    return (
      <>
        <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
          <GrindykSay text={grades.every((g) => g.ok) ? 'Вісім із восьми. Тепер ти знаєш, за що тобі платять.' : 'Розбір чесний: де мимо — повернись до кроку й перерахуй.'} pose={grades.every((g) => g.ok) ? "cheer" : "think"} height={90} />
          <Text style={styles.title}>Розбір · {grades.filter((g) => g.ok).length} з 8</Text>
          <Text style={styles.muted}>Критерії — зворотний звʼязок за кейсом. Очки ліги за них не нараховуються.</Text>
          {CRITERIA.map((c, i) => {
            const g = grades[i];
            const retryIdx = g.retry ? SIM_STEPS.findIndex((x) => x.id === g.retry) : -1;
            return (
              <View key={c.n} style={[styles.crit, { borderColor: g.ok ? C.accent : C.red }]}>
                <Text style={styles.critTxt}>
                  {g.ok ? '✓' : '✕'} {c.n}. {c.text}
                </Text>
                {!g.ok && retryIdx >= 0 && (
                  <Pressable onPress={() => setSim({ ...st, step: retryIdx, back: true, at: Date.now() })} style={styles.linkBtn}>
                    <Text style={styles.link}>Пройти крок ще раз: {SIM_STEPS[retryIdx].stage} →</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          <Kicker>МАТЕРІАЛИ В «БАЗІ»</Kicker>
          <View style={styles.kbRow}>
            {SIM_KB.filter((k) => kbGet(k, 'uk')).map((k) => (
              <Pressable key={k} onPress={() => router.push(`/kb/${k}`)} style={styles.kbChip}>
                <Text style={styles.kbChipTxt}>📘 {kbGet(k, 'uk')?.title ?? k}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
        <View style={{ paddingTop: 10, paddingBottom: insets.bottom + 12, gap: 8 }}>
          <Button title={alreadyDone ? 'Завершити (без нагороди)' : 'Завершити тренажер'} onPress={finish} />
          {alreadyDone && <Button title="Пройти тренажер ще раз (без нагороди)" ghost onPress={again} />}
        </View>
      </>
    );
  }

// ───────── Макети й таблиці над кроком ─────────
function ViewBlock({ v }: { v: SimView }) {
    if (v === 'brief') return <MdBox text={(SIM_STEPS[0] as { step: { body: string } }).step.body} />;
    if (v === 'ads')
      return (
        <>
          <Kicker>ТРИ ОГОЛОШЕННЯ</Kicker>
          {ADS.map((a) => (
            <AdCard key={a.n} ad={a} />
          ))}
          <UnverifiedNote />
        </>
      );
    if (v === 'adsFixed')
      return (
        <>
          <Kicker>ТВІЙ ЗАПУСК · ОДНА ЗМІНА</Kicker>
          <AdCard ad={AD1_FIXED} flag="ok" />
          <UnverifiedNote />
        </>
      );
    if (v === 'landing')
      return (
        <>
          <Kicker>ЛЕНДИНГ · ПЕРШИЙ ЕКРАН</Kicker>
          <LandingMock l={LANDING} />
        </>
      );
    if (v === 'sliceD3') return <ReportTable title="Історичний прогін · зріз на 3-й день" rows={SLICE_D3} />;
    if (v === 'sliceD6') return <ReportTable title="Історичний прогін · зріла когорта (6-й день)" rows={SLICE_D6} />;
    if (v === 'reasons') return <ReportTable title="Причини відмови (19)" rows={REASONS} />;
    if (v === 'variantA') {
      const a = VARIANTS[0];
      return (
        <>
          <ReportTable title="Історичний прогін (оголошення № 1)" rows={[['Прийнято CRM / CPL', '28 / ₴53,6'], ['Підтверджено / апрув', '9 / 32,1%'], ['Результат', '−₴48']]} />
          <ReportTable title="Твій запуск (варіант А)" rows={a.rows ?? []} />
        </>
      );
    }
    return null;
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 18 },
    head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10 },
    x: { color: C.muted, fontSize: 22 },
    pbar: { flex: 1, height: 14, borderRadius: 10, backgroundColor: C.track, overflow: 'hidden' },
    fill: { height: '100%', backgroundColor: C.gold, borderRadius: 10 },
    mode: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
    stage: { color: C.muted, fontSize: 12, fontWeight: '800', marginBottom: 6 },
    title: { color: C.txt, fontSize: 21, fontWeight: '900', marginVertical: 8 },
    q: { color: C.txt, fontSize: 18, fontWeight: '700', marginTop: 10, marginBottom: 10 },
    muted: { color: C.muted, fontSize: 13, marginBottom: 10 },
    opt: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 2, borderBottomWidth: 5, borderRadius: 16, padding: 14, marginBottom: 10 },
    optPressed: { transform: [{ translateY: 3 }], borderBottomWidth: 2 },
    optPicked: { borderColor: C.blue, backgroundColor: C.panel2, borderBottomColor: C.blueEdge },
    optOk: { borderColor: C.accent, backgroundColor: C.accentTint, borderBottomColor: C.accentEdge },
    optNo: { borderColor: C.red, backgroundColor: C.redTint, borderBottomColor: C.redEdge },
    optTxt: { color: C.txt, fontSize: 15 },
    fb: { borderRadius: 14, padding: 12, marginTop: 10 },
    fbOk: { backgroundColor: C.accentTint },
    fbNo: { backgroundColor: C.redTint },
    fbTxt: { fontSize: 15, fontWeight: '800' },
    explain: { color: C.txt, fontSize: 13, marginTop: 6, lineHeight: 19 },
    kbRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    kbChip: { backgroundColor: C.panel, borderRadius: 10, borderWidth: 2, borderBottomWidth: 3, borderColor: C.line, paddingVertical: 6, paddingHorizontal: 10 },
    kbChipTxt: { color: C.blueTxt, fontSize: 12, fontWeight: '800' },
    crit: { backgroundColor: C.panel, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, padding: 10, marginBottom: 8 },
    critTxt: { color: C.txt, fontSize: 14, lineHeight: 20 },
    linkBtn: { marginTop: 6 },
    link: { color: C.blueTxt, fontWeight: '800', fontSize: 13 },
  });
