import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Рушій кроків гілок (ТЗ 004, C1). Старий курс (модулі 01–10) сюди більше не імпортується.
import { shuffleQuestion } from '../../src/data/shuffle';
import { unitById } from '../../src/data/branches';
import type { BStep } from '../../src/data/branch';
import { branchReward, gradeFinal } from '../../src/data/branchRules';
import { lessonPlace, resumeFor } from '../../src/data/place';
import { useStore, ENERGY_PER_LESSON, AnswerResult } from '../../src/store';
import { Theme, useStyles, useTheme } from '../../src/theme';
import { Grindyk } from '../../src/components/Grindyk';
import { say, PhraseKind } from '../../src/data/phrases';
import { Button } from '../../src/components/Button';
import { Icon } from '../../src/components/Icon';
import { Reaction, reactionKind } from '../../src/components/Reaction';
import { playSfx } from '../../src/sound';
import { boostLeftMs } from '../../src/notifications';
import { scaleCoins } from '../../src/economy';
import { Markdown } from '../../src/components/Markdown';
import { OptionFx, Pop } from '../../src/components/Anim';
import { Watermark } from '../../src/components/Watermark';
import { FeedbackSheet } from '../../src/components/FeedbackSheet';
import { CLOUD_MODE } from '../../src/cloud/config';
import { track } from '../../src/cloud/analytics';
import { haptic, useTgMainButton } from '../../src/telegram/webapp';
import { BundleStep, MatchStep, MultiStep, NumericStep, OrderStep, StoryStep } from '../../src/components/steps';

const SECONDS_L1 = 20;
const SECONDS_L2 = 30;
const QUIZ_BASE_COINS = 40;
const QUIZ_BASE_XP = 30;

// Смуга таймера квізу: свій стан і свій інтервал, щоб відлік не перемальовував весь екран уроку
function TimerRow({ leftRef, limit, answered }: { leftRef: React.MutableRefObject<number>; limit: number; answered: boolean }) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const [left, setLeft] = useState(limit);
  useEffect(() => {
    if (answered) return;
    const t = setInterval(() => setLeft(leftRef.current), 200);
    return () => clearInterval(t);
  }, [answered, leftRef]);
  const urgent = left <= 5 && !answered;
  return (
    <View style={styles.timerRow}>
      <Text style={[styles.timerTxt, urgent && { color: C.redTxt }]}>⏱ {Math.ceil(left)} с</Text>
      <View style={styles.timerBar}>
        <View style={[styles.timerFill, { width: `${Math.min(100, (left / limit) * 100)}%`, backgroundColor: urgent ? C.red : C.blue }]} />
      </View>
    </View>
  );
}

export default function LessonScreen() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const spendEnergy = useStore((s) => s.spendEnergy);
  const completed = useStore((s) => s.completed);
  const recordAnswers = useStore((s) => s.recordAnswers);
  const takeComboShield = useStore((s) => s.useComboShield);
  const takeHint = useStore((s) => s.useHint);
  const hintsLeft = useStore((s) => s.hints);
  const doubleCoins = useStore((s) => s.doubleCoins);

  const setBranchProg = useStore((s) => s.setBranchProg);
  const ref = useMemo(() => unitById(id), [id]);
  const kind = ref?.kind;
  const code = ref?.branch.code ?? '';
  const hub = `/branch/${code}` as const;
  const isDiagnostic = false;
  const isCheckpoint = false;
  const isQuiz = false;
  // один обʼєкт на маршрут: інакше варіанти перемішувались би на кожному рендері
  const lesson = useMemo(() => (ref && ref.unit.ready && ref.unit.steps.length ? { ...ref.unit, minutes: 5 } : undefined), [ref]);
  const alreadyDone = lesson ? completed.includes(lesson.id) : false;

  const steps: BStep[] = useMemo(() => {
    if (!lesson) return [];
    // Варіанти перемішуються при КОЖНОМУ проходженні
    return lesson.steps.map((s) => (s.type === 'teach' || s.type === 'reflect' ? s : (shuffleQuestion(s as never) as BStep)));
  }, [lesson]);
  const [hintOpen, setHintOpen] = useState(false);
  const [note, setNote] = useState(''); // «твоє пояснення»: не оцінюється, показується поруч з еталоном
  // «Продовжити» (етап E): той самий урок відкривається з кроку, на якому гравець вийшов, разом із відповідями до нього
  const setPlace = useStore((s) => s.setPlace);
  const [resume, setResume] = useState(() => resumeFor(useStore.getState().placeBox, id ?? '', steps.length));
  const chosenRef = useRef<Record<number, number>>(resume?.chosen ?? {});

  const [idx, setIdx] = useState(resume?.idx ?? 0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [extCorrect, setExtCorrect] = useState<boolean | null>(null); // результат завдань з власним інтерфейсом
  const [answered, setAnswered] = useState(false);
  const [combo, setCombo] = useState(0);
  const [maxBonus, setMaxBonus] = useState(0);
  const [correct, setCorrect] = useState(resume?.correct ?? 0);
  const [errors, setErrors] = useState(resume?.errors ?? 0);
  const [timedOut, setTimedOut] = useState(false);
  const [speedPts, setSpeedPts] = useState(0);
  const [shieldHit, setShieldHit] = useState(false);
  const [hidden, setHidden] = useState<number | null>(null); // варіант, прибраний підказкою
  const resultsRef = useRef<AnswerResult[]>(resume?.results ?? []);
  const [wrongSteps, setWrongSteps] = useState<number[]>(() => (resume?.results ?? []).filter((r) => !r.ok).map((r) => r.idx));
  const leftRef = useRef(0);

  // Квіз іде на час: 20 с на питання, 30 с на сценарну задачу
  const cur = steps[idx];
  const limit = isQuiz && cur && cur.type !== 'teach' && cur.type !== 'reflect' ? (cur.layer === 2 ? SECONDS_L2 : SECONDS_L1) : 0;

  useEffect(() => {
    if (!limit || answered) return;
    const deadline = Date.now() + limit * 1000;
    leftRef.current = limit;
    const timer = setInterval(() => {
      const left = Math.max(0, (deadline - Date.now()) / 1000);
      leftRef.current = left; // відлік показує окремий TimerRow зі своїм станом: увесь урок не перемальовується 5 разів на секунду
      if (left <= 0) {
        clearInterval(timer);
        setSelected(-1);
        setTimedOut(true);
        setAnswered(true);
        setCombo(0);
        setErrors((e) => e + 1);
        pushResult(false);
        playSfx('wrong');
      }
    }, 200);
    return () => clearInterval(timer);
  }, [idx, limit, answered]);

  const lessonKey = lesson?.id;
  useEffect(() => {
    if (lessonKey) track('lesson_start', { lesson: lessonKey });
  }, [lessonKey]);

  // фінал товарки — тренажер «Ліди» на власному екрані
  if (ref?.unit.sim === 'leads') return <Redirect href="/leads" />;
  if (!lesson) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.q}>Урок не знайдено</Text>
        <Button title="Назад" onPress={() => router.replace(ref ? hub : '/home')} />
      </View>
    );
  }

  const lsn = lesson;
  const step = steps[idx];
  const total = steps.length;
  const isTeach = step.type === 'teach';
  const isReflect = step.type === 'reflect';
  const isChoiceLike = step.type === 'choice' || step.type === 'fill';
  const isCorrect = step.type === 'teach' || step.type === 'reflect' ? false : isChoiceLike ? selected === step.answer : extCorrect === true;
  const canContinue = isTeach || isReflect || answered;
  const needsCheck = isChoiceLike && !answered;

  // У Telegram головна кнопка екрана це MainButton Telegram (власну тоді ховаємо)
  const mainTitle = isTeach ? (isQuiz && idx === 0 ? 'Старт' : 'Зрозумів') : needsCheck ? 'Перевірити' : idx + 1 >= total ? 'Завершити' : 'Далі';
  const mainDisabled = needsCheck ? selected === null : !canContinue;
  const tgMain = useTgMainButton({ text: mainTitle, onPress: needsCheck ? onCheck : onContinue, enabled: !mainDisabled, visible: true });

  function refFor(i: number) {
    return { lessonId: id, idx: i };
  }

  function pushResult(ok: boolean) {
    resultsRef.current.push({ ...refFor(idx), ok });
    if (!ok) setWrongSteps((w) => [...w, idx]);
  }

  function record(ok: boolean) {
    pushResult(ok);
    playSfx(ok ? 'correct' : 'wrong');
    if (ok) haptic.success();
    else haptic.error();
    if (ok) {
      const nextCombo = combo + 1;
      const bonus = Math.min(20, nextCombo * 2);
      setCombo(nextCombo);
      setMaxBonus((m) => Math.max(m, bonus));
      setCorrect((c) => c + 1);
      if (limit) setSpeedPts((p) => p + Math.round(5 * (leftRef.current / limit)));
    } else {
      setErrors((e) => e + 1);
      if (combo > 0 && takeComboShield()) {
        setShieldHit(true); // захист із магазину зберіг комбо
      } else {
        setCombo(0);
      }
    }
  }

  function useHintNow() {
    if (answered || hidden !== null || (step.type !== 'choice' && step.type !== 'fill') || !takeHint()) return;
    const wrong = step.options.map((_, k) => k).filter((k) => k !== step.answer);
    const h = wrong[Math.floor(Math.random() * wrong.length)];
    setHidden(h);
    if (selected === h) setSelected(null);
  }

  // Вибір варіанта лише підсвічує його; зарахування відбувається після кнопки «Перевірити»
  function onPick(k: number) {
    if (step.type === 'reflect') return setSelected(k);
    if (answered || (step.type !== 'choice' && step.type !== 'fill')) return;
    setSelected(k);
  }

  function onCheck() {
    if (answered || selected === null || (step.type !== 'choice' && step.type !== 'fill')) return;
    chosenRef.current[idx] = selected;
    setAnswered(true);
    record(selected === step.answer);
  }

  function onExternal(ok: boolean) {
    if (answered) return;
    setExtCorrect(ok);
    setAnswered(true);
    record(ok);
  }

  // «Почати заново» (ТЗ 006, 2.2): скинути збережене місце й відповіді; нагород і зарахування це не дає
  function restart() {
    resultsRef.current = [];
    chosenRef.current = {};
    setWrongSteps([]);
    setCorrect(0);
    setErrors(0);
    setIdx(0);
    setResume(null);
    setPlace(null, code);
    setSelected(null);
    setExtCorrect(null);
    setAnswered(false);
  }

  function onContinue() {
    if (idx + 1 >= total) {
      // одиницю завершено: місця немає, «Продовжити» поведе до наступної одиниці цієї гілки
      setPlace(null, code);
      // Точність (leaderboard_accuracy): усі перевірювані завдання гілок, самоперевірки, практики й фіналів
      recordAnswers(resultsRef.current, { rated: true });
      track('lesson_complete', { lesson: lsn.id, correct, errors });
      if (kind !== 'selfcheck') spendEnergy(ENERGY_PER_LESSON);

      const okAt = (i: number) => !resultsRef.current.some((r) => r.idx === i && !r.ok);
      const qIdx = steps.map((s, i) => (s.type === 'teach' || s.type === 'reflect' ? -1 : i)).filter((i) => i >= 0);
      const firstWrong = qIdx.find((i) => !okAt(i));
      const allOk = firstWrong === undefined;

      // Самоперевірка: без нагороди й без позначки уроків; результат і місце — у прогресі гілки
      if (kind === 'selfcheck') {
        const w = firstWrong !== undefined ? steps[firstWrong] : undefined;
        setBranchProg(code, allOk ? { sc: 'pass', scSee: undefined, scWhy: undefined, started: true } : { sc: 'fail', scSee: w?.see, scWhy: (w as { explain?: string } | undefined)?.explain, started: true });
        router.dismissTo(hub);
        return;
      }
      if (kind === 'practice') {
        const w = firstWrong !== undefined ? steps[firstWrong] : undefined;
        setBranchProg(code, allOk ? { practice: 'pass', prSee: undefined, prWhy: undefined, started: true } : { practice: 'fail', prSee: w?.see, prWhy: (w as { explain?: string } | undefined)?.explain, started: true });
        if (!allOk) return router.dismissTo(hub);
      }
      // Фінал: рішення, дані й наступний крок оцінюються окремо; «запускати» без допуску блокує зарахування
      let passed = true;
      if (kind === 'final') {
        const g = gradeFinal(steps as never, okAt, chosenRef.current);
        passed = g.passed;
        setBranchProg(code, { finalGaps: g.gaps, blocked: g.blocked, started: true });
        if (!passed) return router.dismissTo(hub);
      }

      const baseCoins = kind === 'final' ? 40 : 20;
      const baseXp = kind === 'final' ? 50 : 10;
      const r = branchReward({
        kind: kind ?? 'lesson',
        passed,
        alreadyDone,
        base: { coins: baseCoins + Math.round((baseCoins * maxBonus) / 100) + correct * 5 + speedPts, xp: baseXp + correct * 3 + Math.round(speedPts * 0.6) },
      });
      let coins = r.coins;
      let xp = r.xp;
      const doubled = doubleCoins > 0 && coins > 0 && !isDiagnostic;
      if (doubled) coins *= 2;
      // X2-вікно посеред дня (10 хвилин після сповіщення): подвоює коїни й XP
      if (!isDiagnostic && boostLeftMs() > 0) {
        coins *= 2;
        xp *= 2;
      }
      if (isDiagnostic) {
        coins = 0;
        xp = 0;
      }
      // Коїни нараховуються вдвічі повільніше (множник у src/economy.ts); XP не чіпаємо
      coins = scaleCoins(coins);

      router.replace({
        pathname: '/results',
        params: {
          id: lsn.id,
          correct: String(correct),
          errors: String(errors),
          maxBonus: String(maxBonus),
          coins: String(coins),
          xp: String(xp),
          practice: alreadyDone ? '1' : '0',
          checkpoint: isCheckpoint ? '1' : '0',
          passed: passed ? '1' : '0',
          speed: String(speedPts),
          doubled: doubled ? '1' : '0',
        },
      });
      return;
    }
    setIdx(idx + 1);
    // зберегти місце: наступний крок і відповіді до нього (і для самоперевірки — ТЗ 006, 2.2)
    const pl = lessonPlace({ id: lsn.id, idx: idx + 1, total, results: [...resultsRef.current], chosen: { ...chosenRef.current }, correct, errors, title: `${ref?.branch.title} · ${lsn.title}` }, Date.now());
    if (pl) setPlace(pl, code);
    setHintOpen(false);
    setNote('');
    setSelected(null);
    setExtCorrect(null);
    setAnswered(false);
    setTimedOut(false);
    setShieldHit(false);
    setHidden(null);
  }

  const mood = isTeach
    ? 'think'
    : !answered
    ? 'neutral'
    : isCorrect
    ? combo >= 3
      ? 'fire'
      : 'happy'
    : 'oops';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <View style={styles.head}>
        <Pressable
          onPress={() => {
            track('lesson_exit', { lesson: lsn.id, step: idx, total });
            router.dismissTo(hub);
          }}
        >
          <Text style={styles.x}>✕</Text>
        </Pressable>
        <View style={styles.pbar}>
          {steps.map((_, k) => (
            <View
              key={k}
              style={[
                styles.seg,
                k < idx && { backgroundColor: wrongSteps.includes(k) ? C.red : C.accent },
                k === idx && answered && { backgroundColor: wrongSteps.includes(k) ? C.red : C.accent },
              ]}
            />
          ))}
        </View>
        <View style={styles.comboBox}>
          {CLOUD_MODE !== 'off' && (
            <Pressable onPress={() => setFeedbackOpen(true)} hitSlop={8} accessibilityLabel="Повідомити про помилку або запропонувати">
              <Text style={styles.report}>🐞</Text>
            </Pressable>
          )}
          {combo > 0 && (
            <>
              <Icon name="streak" size={22} />
              <Text style={styles.combo}>x{combo}</Text>
            </>
          )}
        </View>
      </View>

      <Text style={[styles.mode, kind === 'final' && { color: C.goldTxt }]}>
        {kind === 'selfcheck'
          ? `🧭 САМОПЕРЕВІРКА · ${ref?.branch.title} · без нагороди`
          : alreadyDone
          ? '🔁 ПОВТОРЕННЯ · без нагороди (уже зараховано)'
          : kind === 'final'
          ? `🏁 ФІНАЛ · рішення, дані, наступний крок${ref?.branch.regulated ? ' · без запуску' : ''}`
          : kind === 'practice'
          ? `🎯 ПРАКТИКА · ${ref?.branch.title}`
          : `${ref?.branch.emoji} ${ref?.branch.title.toUpperCase()} · ${lsn.title}`}
      </Text>

      {resume && idx === resume.idx && !answered && (
        <View style={styles.resumeBox}>
          <Text style={[styles.mode, { color: C.accentTxt, flex: 1 }]}>↩ Продовжуємо з кроку {resume.idx + 1} з {total}</Text>
          <Pressable onPress={restart} hitSlop={8} accessibilityRole="button" accessibilityLabel="Почати заново">
            <Text style={styles.restart}>Почати заново</Text>
          </Pressable>
        </View>
      )}
      {limit > 0 && <TimerRow key={idx} leftRef={leftRef} limit={limit} answered={answered} />}

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {isTeach ? (
          <>
            <Text style={[styles.layer, { color: C.goldTxt }]}>{ref ? 'БРИФ' : 'ТЕОРІЯ'}</Text>
            <View style={styles.teachHero}>
              <Grindyk mood="think" size={64} />
            </View>
            <Text style={styles.teachTitle}>{step.title}</Text>
            <Markdown text={step.body} />
            {step.cards && (
              <View style={styles.cards}>
                {step.cards.map((c, i) => (
                  <View key={i} style={styles.card}>
                    <Text style={styles.cardIcon}>{c.icon}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>{c.title}</Text>
                      <Text style={styles.cardTxt}>{c.text}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
            {step.example && (
              <View style={styles.example}>
                <Text style={styles.exampleLabel}>ПРИКЛАД</Text>
                <Text style={styles.exampleTxt}>{step.example}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={{ height: 10 }} />
            <View style={styles.qRow}>
              <Grindyk mood={mood} size={40} />
              <Text style={styles.q}>{step.q}</Text>
            </View>

            {step.type === 'reflect' && (
              <>
                <Text style={styles.reflectTag}>РЕФЛЕКСІЯ · правильної відповіді нема</Text>
                {step.hint ? (
                  <View style={styles.reflectHint}>
                    <Text style={styles.reflectHintTxt}>💭 {step.hint}</Text>
                  </View>
                ) : null}
              </>
            )}

            {step.type !== 'reflect' && step.type !== 'fill' && step.scenario && (
              <View style={styles.scenario}>
                <Markdown text={step.scenario} small />
              </View>
            )}

            {step.type === 'fill' && (
              <Text style={styles.fillLine}>
                {step.before}
                <Text style={styles.blank}>{answered ? step.options[step.answer] : '____'}</Text>
                {step.after}
              </Text>
            )}

            {!answered && step.hint && !hintOpen && (
              <Pressable onPress={() => setHintOpen(true)} style={styles.hintBtn} accessibilityRole="button">
                <Text style={styles.hintTxt}>🦝 Підказка Гріндіка</Text>
              </Pressable>
            )}
            {!answered && step.hint && hintOpen && (
              <View style={styles.reflectHint}>
                <Text style={styles.reflectHintTxt}>🦝 {step.hint}</Text>
              </View>
            )}
            {!answered && hintsLeft > 0 && (step.type === 'choice' || step.type === 'fill') && hidden === null && (
              <Pressable onPress={useHintNow} style={styles.hintBtn}>
                <Text style={styles.hintTxt}>💡 Прибрати варіант ({hintsLeft})</Text>
              </Pressable>
            )}

            <View style={{ marginTop: 12 }}>
              {step.type === 'reflect' &&
                step.options.map((o, k) => (
                  <Pressable key={k} onPress={() => onPick(k)} style={({ pressed }) => [styles.opt, k === selected && styles.optPicked, pressed && styles.optPressed]}>
                    <Text style={styles.optTxt}>{o}</Text>
                  </Pressable>
                ))}
              {step.type === 'reflect' && selected !== null && step.note ? <Text style={styles.reflectNote}>{step.note}</Text> : null}
              {(step.type === 'choice' || step.type === 'fill') &&
                step.options.map((o, k) => {
                  const showCorrect = answered && k === step.answer;
                  const showWrong = answered && k === selected && k !== step.answer;
                  const picked = !answered && k === selected;
                  if (k === hidden) return null;
                  return (
                    <OptionFx key={k} state={showCorrect ? 'correct' : showWrong ? 'wrong' : picked ? 'picked' : 'idle'}>
                    <Pressable
                      disabled={answered}
                      onPress={() => onPick(k)}
                      style={({ pressed }) => [
                        styles.opt,
                        showCorrect && styles.optCorrect,
                        showWrong && styles.optWrong,
                        picked && styles.optPicked,
                        pressed && !answered && styles.optPressed,
                      ]}
                    >
                      <Text style={styles.optTxt}>{o}</Text>
                    </Pressable>
                    </OptionFx>
                  );
                })}
              {step.type === 'multi' && (
                <MultiStep key={`${idx}`} step={step} resolution={answered ? { correct: isCorrect } : null} onResolve={onExternal} />
              )}
              {step.type === 'order' && (
                <OrderStep key={`${idx}`} step={step} resolution={answered ? { correct: isCorrect } : null} onResolve={onExternal} />
              )}
              {step.type === 'match' && (
                <MatchStep key={`${idx}`} step={step} resolution={answered ? { correct: isCorrect } : null} onResolve={onExternal} />
              )}
              {step.type === 'bundle' && (
                <BundleStep key={`${idx}`} step={step} resolution={answered ? { correct: isCorrect } : null} onResolve={onExternal} />
              )}
              {step.type === 'story' && (
                <StoryStep key={`${idx}`} step={step} resolution={answered ? { correct: isCorrect } : null} onResolve={onExternal} />
              )}
              {step.type === 'numeric' && (
                <NumericStep key={`${idx}`} step={step} resolution={answered ? { correct: isCorrect } : null} onResolve={onExternal} />
              )}
            </View>
            {(kind === 'lesson' || kind === 'final') && !answered && (
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="Твоє пояснення (необовʼязково, не оцінюється)"
                placeholderTextColor={C.muted}
                multiline
                maxLength={500}
                style={styles.noteInput}
              />
            )}
          </>
        )}
      </ScrollView>

      {!isTeach && !isReflect && answered && (
        <Pop from="up" key={`fb-${idx}`}>
        <View style={[styles.fb, isCorrect ? styles.fbOk : styles.fbNo]}>
          <Reaction key={`r-${idx}`} kind={reactionKind(timedOut ? 'timeout' : isCorrect ? 'good' : 'bad', combo)} size={58} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.fbTxt, { color: isCorrect ? C.accent : C.red }]}>
              {timedOut ? '⏱ Час вийшов. Правильна відповідь підсвічена зеленим.' : isCorrect ? step.okMsg : step.noMsg}
            </Text>
            {step.explain && <Text style={styles.explain}>{ref ? `Еталон: ${step.explain}` : step.explain}</Text>}
            {!isCorrect && step.hint && <Text style={styles.explain}>🦝 {step.hint}</Text>}
            {note.trim() ? <Text style={styles.explain}>Твоє пояснення: {note.trim()}</Text> : null}
            {shieldHit && <Text style={styles.shield}>🛡️ Захист комбо врятував серію</Text>}
            <Quip kind={timedOut ? 'timeout' : isCorrect ? (combo >= 5 ? 'combo5' : combo >= 3 ? 'combo3' : 'correct') : 'wrong'} />
          </View>
        </View>
        </Pop>
      )}

      <View style={{ paddingTop: 12, paddingBottom: insets.bottom + 12, display: tgMain ? 'none' : 'flex' }}>
        <Button
          title={isTeach ? (isQuiz && idx === 0 ? 'Старт' : 'Зрозумів') : needsCheck ? 'Перевірити' : idx + 1 >= total ? 'Завершити' : 'Далі'}
          onPress={needsCheck ? onCheck : onContinue}
          disabled={needsCheck ? selected === null : !canContinue}
        />
      </View>
      <FeedbackSheet visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} context={{ screen: 'lesson', lessonId: id, stepIdx: idx }} />
      <Watermark />
    </View>
  );
}

// Репліка Гріндіка під відповідь: одна на показ фідбеку, не змінюється при перерендері
function Quip({ kind }: { kind: PhraseKind }) {
  const styles = useStyles(makeStyles);
  const text = useMemo(() => say(kind).text, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Text style={styles.quip}>Гріндік: {text}</Text>;
}

const makeStyles = (C: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 22 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10 },
  x: { color: C.muted, fontSize: 22 },
  pbar: { flex: 1, height: 16, flexDirection: 'row', gap: 2, borderRadius: 10, overflow: 'hidden' },
  seg: { flex: 1, backgroundColor: C.track },
  fill: { height: '100%', backgroundColor: C.accent, borderRadius: 10 },
  noteInput: { marginTop: 14, minHeight: 56, borderRadius: 12, borderWidth: 2, borderColor: C.line, backgroundColor: C.panel, color: C.txt, padding: 10, fontSize: 14, textAlignVertical: 'top' },
  hintBtn: { alignSelf: 'flex-start', backgroundColor: C.panel2, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 12, borderWidth: 2, borderColor: C.gold, marginTop: 6 },
  hintTxt: { color: C.goldTxt, fontWeight: '800', fontSize: 13 },
  shield: { color: C.blueTxt, fontWeight: '800', fontSize: 13, marginTop: 6 },
  cards: { gap: 10, marginBottom: 14 },
  card: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: C.panel, borderRadius: 14, padding: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line },
  cardIcon: { fontSize: 30 },
  cardTitle: { color: C.txt, fontWeight: '800', fontSize: 15 },
  cardTxt: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 2 },
  quip: { color: C.muted, fontSize: 13, fontStyle: 'italic', marginTop: 6 },
  reflectTag: { color: C.muted, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginTop: 6 },
  reflectHint: { marginTop: 10, borderLeftWidth: 4, borderLeftColor: C.blue, backgroundColor: C.panel2, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  reflectHintTxt: { color: C.muted, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
  reflectNote: { color: C.muted, fontSize: 13, lineHeight: 19, marginTop: 8 },
  report: { fontSize: 18, opacity: 0.75 },
  comboBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, minWidth: 56 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  timerTxt: { color: C.blueTxt, fontSize: 13, fontWeight: '800', minWidth: 52 },
  timerBar: { flex: 1, height: 8, backgroundColor: C.track, borderRadius: 6, overflow: 'hidden' },
  timerFill: { height: '100%', borderRadius: 6 },
  combo: { color: C.fireTxt, fontWeight: '800', fontSize: 15 },
  mode: { color: C.blueTxt, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  resumeBox: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  restart: { color: C.blueTxt, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
  layer: { color: C.blueTxt, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginVertical: 8 },
  qRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  q: { color: C.txt, fontSize: 20, fontWeight: '700', flex: 1, marginTop: 4 },
  teachHero: { alignItems: 'center', marginVertical: 8 },
  teachTitle: { color: C.txt, fontSize: 22, fontWeight: '800', marginTop: 4, marginBottom: 12 },
  teachBody: { color: C.txt, fontSize: 16, lineHeight: 25 },
  example: {
    backgroundColor: C.panel2,
    borderLeftColor: C.gold,
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },
  exampleLabel: { color: C.goldTxt, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
  exampleTxt: { color: C.txt, fontSize: 15, lineHeight: 22 },
  scenario: {
    backgroundColor: C.panel2,
    borderLeftColor: C.blue,
    borderLeftWidth: 3,
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  scenarioTxt: { color: C.txt, fontSize: 14, lineHeight: 20 },
  fillLine: { color: C.txt, fontSize: 17, lineHeight: 30, marginTop: 12 },
  blank: { color: C.accentTxt, fontWeight: '800' },
  opt: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 2,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderBottomWidth: 5,
  },
  optPressed: { transform: [{ translateY: 3 }], borderBottomWidth: 2 },
  optPicked: {
    borderColor: C.blue,
    backgroundColor: C.panel2,
    borderBottomColor: C.blueEdge,
  },
  optCorrect: {
    borderColor: C.accent,
    backgroundColor: C.accentTint,
    borderBottomColor: C.accentEdge,
  },
  optWrong: {
    borderColor: C.red,
    backgroundColor: C.redTint,
    borderBottomColor: C.redEdge,
  },
  optTxt: { color: C.txt, fontSize: 16 },
  fb: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 14, alignItems: 'flex-start' },
  fbOk: { backgroundColor: C.accentTint },
  fbNo: { backgroundColor: C.redTint },
  fbBig: { fontSize: 26 },
  fbTxt: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  explain: { color: C.txt, fontSize: 13, marginTop: 6, lineHeight: 18 },
});
