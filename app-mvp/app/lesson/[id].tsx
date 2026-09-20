import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shuffleQuestion, Step } from '../../src/data/lessons';
import { ALL_LESSONS } from '../../src/data/modules';
import { useStore, ENERGY_PER_LESSON } from '../../src/store';
import { C } from '../../src/theme';
import { Grindyk } from '../../src/components/Grindyk';
import { Button } from '../../src/components/Button';
import { Icon } from '../../src/components/Icon';

const SECONDS_L1 = 20;
const SECONDS_L2 = 30;
const QUIZ_BASE_COINS = 40;
const QUIZ_BASE_XP = 30;

export default function LessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const spendEnergy = useStore((s) => s.spendEnergy);
  const completed = useStore((s) => s.completed);

  const lesson = useMemo(() => ALL_LESSONS.find((l) => l.id === id), [id]);
  const isCheckpoint = lesson?.kind === 'checkpoint';
  const isQuiz = lesson?.kind === 'quiz';
  const alreadyDone = lesson ? completed.includes(lesson.id) : false;

  const steps: Step[] = useMemo(() => {
    if (!lesson) return [];
    return isQuiz ? lesson.steps.map((s) => (s.type === 'teach' ? s : shuffleQuestion(s))) : lesson.steps;
  }, [lesson, isQuiz]);

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [combo, setCombo] = useState(0);
  const [maxBonus, setMaxBonus] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [errors, setErrors] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timedOut, setTimedOut] = useState(false);
  const [speedPts, setSpeedPts] = useState(0);
  const leftRef = useRef(0);

  // Квіз іде на час: 20 с на питання, 30 с на сценарну задачу
  const cur = steps[idx];
  const limit = isQuiz && cur && cur.type !== 'teach' ? (cur.layer === 2 ? SECONDS_L2 : SECONDS_L1) : 0;

  useEffect(() => {
    if (!limit || answered) return;
    const deadline = Date.now() + limit * 1000;
    leftRef.current = limit;
    setTimeLeft(limit);
    const timer = setInterval(() => {
      const left = Math.max(0, (deadline - Date.now()) / 1000);
      leftRef.current = left;
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(timer);
        setSelected(-1);
        setTimedOut(true);
        setAnswered(true);
        setCombo(0);
        setErrors((e) => e + 1);
      }
    }, 200);
    return () => clearInterval(timer);
  }, [idx, limit, answered]);

  if (!lesson) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.q}>Урок не знайдено</Text>
        <Button title="Назад" onPress={() => router.replace('/home')} />
      </View>
    );
  }

  const lsn = lesson;
  const step = steps[idx];
  const total = steps.length;
  const isTeach = step.type === 'teach';
  const isCorrect = !isTeach && selected === step.answer;
  const canContinue = isTeach || answered;

  function onAnswer(k: number) {
    if (answered || step.type === 'teach') return;
    setSelected(k);
    setAnswered(true);
    if (k === step.answer) {
      const nextCombo = combo + 1;
      const bonus = Math.min(20, nextCombo * 2);
      setCombo(nextCombo);
      setMaxBonus((m) => Math.max(m, bonus));
      setCorrect((c) => c + 1);
      if (limit) setSpeedPts((p) => p + Math.round(5 * (leftRef.current / limit)));
    } else {
      setCombo(0);
      setErrors((e) => e + 1);
    }
  }

  function onContinue() {
    if (idx + 1 >= total) {
      spendEnergy(ENERGY_PER_LESSON);

      const accuracy = correct + errors > 0 ? correct / (correct + errors) : 1;
      const passed = !isCheckpoint || accuracy >= (lsn.passThreshold ?? 0.8);

      const baseCoins = isCheckpoint ? 40 : isQuiz ? QUIZ_BASE_COINS : 20;
      const baseXp = isCheckpoint ? 50 : isQuiz ? QUIZ_BASE_XP : 10;
      let coins = baseCoins + Math.round((baseCoins * maxBonus) / 100) + correct * 5 + speedPts;
      let xp = baseXp + correct * 3 + Math.round(speedPts * 0.6);

      if (alreadyDone) {
        coins = Math.round(coins / 2);
        xp = Math.round(xp / 2);
      }
      if (isCheckpoint && !passed) {
        coins = 0;
        xp = 0;
      }

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
        },
      });
      return;
    }
    setIdx(idx + 1);
    setSelected(null);
    setAnswered(false);
    setTimedOut(false);
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
        <Pressable onPress={() => router.replace('/home')}>
          <Text style={styles.x}>✕</Text>
        </Pressable>
        <View style={styles.pbar}>
          <View style={[styles.fill, { width: `${(idx / total) * 100}%` }]} />
        </View>
        <View style={styles.comboBox}>
          {combo > 0 && (
            <>
              <Icon name="streak" size={22} />
              <Text style={styles.combo}>x{combo}</Text>
            </>
          )}
        </View>
      </View>

      {(isCheckpoint || alreadyDone || isQuiz) && (
        <Text style={[styles.mode, isCheckpoint && { color: C.gold }]}>
          {isCheckpoint
            ? '👑 ТЕСТ НА КОРОНУ · потрібно 80%'
            : alreadyDone
            ? '🔁 ПОВТОРЕННЯ · нагорода ½'
            : '⏱ КВІЗ НА ЧАС · бонусна нагорода'}
        </Text>
      )}

      {limit > 0 && (
        <View style={styles.timerRow}>
          <Text style={[styles.timerTxt, timeLeft <= 5 && !answered && { color: C.red }]}>
            ⏱ {Math.ceil(timeLeft)} с
          </Text>
          <View style={styles.timerBar}>
            <View
              style={[
                styles.timerFill,
                {
                  width: `${Math.min(100, (timeLeft / limit) * 100)}%`,
                  backgroundColor: timeLeft <= 5 && !answered ? C.red : C.blue,
                },
              ]}
            />
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
        {isTeach ? (
          <>
            <Text style={[styles.layer, { color: C.gold }]}>ТЕОРІЯ</Text>
            <View style={styles.teachHero}>
              <Grindyk mood="think" size={64} />
            </View>
            <Text style={styles.teachTitle}>{step.title}</Text>
            <Text style={styles.teachBody}>{step.body}</Text>
            {step.example && (
              <View style={styles.example}>
                <Text style={styles.exampleLabel}>ПРИКЛАД</Text>
                <Text style={styles.exampleTxt}>{step.example}</Text>
              </View>
            )}
          </>
        ) : (
          <>
            <Text style={styles.layer}>
              {step.layer === 1 ? 'ШАР 1 · РОЗУМІННЯ' : 'ШАР 2 · ЗАСТОСУВАННЯ'}
            </Text>
            <View style={styles.qRow}>
              <Grindyk mood={mood} size={40} />
              <Text style={styles.q}>{step.q}</Text>
            </View>

            {step.type === 'choice' && step.scenario && (
              <View style={styles.scenario}>
                <Text style={styles.scenarioTxt}>{step.scenario}</Text>
              </View>
            )}

            {step.type === 'fill' && (
              <Text style={styles.fillLine}>
                {step.before}
                <Text style={styles.blank}>{answered ? step.options[step.answer] : '____'}</Text>
                {step.after}
              </Text>
            )}

            <View style={{ marginTop: 12 }}>
              {step.options.map((o, k) => {
                const showCorrect = answered && k === step.answer;
                const showWrong = answered && k === selected && k !== step.answer;
                return (
                  <Pressable
                    key={k}
                    disabled={answered}
                    onPress={() => onAnswer(k)}
                    style={({ pressed }) => [
                      styles.opt,
                      showCorrect && styles.optCorrect,
                      showWrong && styles.optWrong,
                      pressed && !answered && styles.optPressed,
                    ]}
                  >
                    <Text style={styles.optTxt}>{o}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {!isTeach && answered && (
        <View style={[styles.fb, isCorrect ? styles.fbOk : styles.fbNo]}>
          <Text style={styles.fbBig}>{isCorrect ? (combo >= 3 ? '🔥' : '👍') : '👀'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fbTxt, { color: isCorrect ? C.accent : C.red }]}>
              {timedOut ? '⏱ Час вийшов. Правильна відповідь підсвічена зеленим.' : isCorrect ? step.okMsg : step.noMsg}
            </Text>
            {step.explain && <Text style={styles.explain}>{step.explain}</Text>}
          </View>
        </View>
      )}

      <View style={{ paddingTop: 12, paddingBottom: insets.bottom + 12 }}>
        <Button
          title={isTeach ? (isQuiz && idx === 0 ? 'Старт' : 'Зрозумів') : idx + 1 >= total ? 'Завершити' : 'Далі'}
          onPress={onContinue}
          disabled={!canContinue}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 22 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 10 },
  x: { color: C.muted, fontSize: 22 },
  pbar: { flex: 1, height: 16, backgroundColor: '#191e28', borderRadius: 10, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: C.accent, borderRadius: 10 },
  comboBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, minWidth: 56 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  timerTxt: { color: C.blue, fontSize: 13, fontWeight: '800', minWidth: 52 },
  timerBar: { flex: 1, height: 8, backgroundColor: '#191e28', borderRadius: 6, overflow: 'hidden' },
  timerFill: { height: '100%', borderRadius: 6 },
  combo: { color: C.fire, fontWeight: '800', fontSize: 15 },
  mode: { color: C.blue, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  layer: { color: C.blue, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginVertical: 8 },
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
  exampleLabel: { color: C.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 6 },
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
  blank: { color: C.accent, fontWeight: '800' },
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
  optCorrect: {
    borderColor: C.accent,
    backgroundColor: 'rgba(54,226,122,0.14)',
    borderBottomColor: C.accentEdge,
  },
  optWrong: {
    borderColor: C.red,
    backgroundColor: 'rgba(255,92,92,0.12)',
    borderBottomColor: C.redEdge,
  },
  optTxt: { color: C.txt, fontSize: 16 },
  fb: { flexDirection: 'row', gap: 10, borderRadius: 14, padding: 14, alignItems: 'flex-start' },
  fbOk: { backgroundColor: 'rgba(54,226,122,0.12)' },
  fbNo: { backgroundColor: 'rgba(255,92,92,0.12)' },
  fbBig: { fontSize: 26 },
  fbTxt: { fontSize: 15, fontWeight: '600', lineHeight: 20 },
  explain: { color: C.txt, fontSize: 13, marginTop: 6, lineHeight: 18 },
});
