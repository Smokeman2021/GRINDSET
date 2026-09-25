import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isQuizId, nextAfter } from '../src/data/modules';
import { useStore } from '../src/store';
import { Button } from '../src/components/Button';
import { Icon } from '../src/components/Icon';
import { C } from '../src/theme';
import { GrindykSay } from '../src/components/GrindykSay';
import { say, PhraseKind } from '../src/data/phrases';

export default function Results() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const completeLesson = useStore((s) => s.completeLesson);
  const params = useLocalSearchParams<{
    id: string;
    correct: string;
    errors: string;
    maxBonus: string;
    speed: string;
    coins: string;
    xp: string;
    practice: string;
    checkpoint: string;
    passed: string;
  }>();

  const correct = Number(params.correct ?? 0);
  const errors = Number(params.errors ?? 0);
  const maxBonus = Number(params.maxBonus ?? 0);
  const speed = Number(params.speed ?? 0);
  const coins = Number(params.coins ?? 0);
  const xp = Number(params.xp ?? 0);
  const id = params.id ?? '';
  const isPractice = params.practice === '1';
  const isCheckpoint = params.checkpoint === '1';
  const passed = params.passed !== '0';

  const [leveledUp, setLeveledUp] = useState(false);
  const scale = useRef(new Animated.Value(0)).current;

  const saved = useRef(false);
  useEffect(() => {
    if (!saved.current && id) {
      saved.current = true;
      const before = useStore.getState().level;
      if (passed) {
        completeLesson(id, coins, xp);
      }
      const after = useStore.getState().level;
      if (after > before) {
        setLeveledUp(true);
        Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
      }
    }
  }, [id, coins, xp, passed, completeLesson, scale]);

  const perfect = errors === 0;
  const accuracy = correct + errors > 0 ? Math.round((correct / (correct + errors)) * 100) : 0;
  const level = useStore((s) => s.level);

  const isQuiz = isQuizId(id);
  const next = isQuiz ? undefined : nextAfter(id);

  const failedCheckpoint = isCheckpoint && !passed;

  const talkKind: PhraseKind = failedCheckpoint
    ? 'crownFail'
    : isCheckpoint
    ? 'crownPass'
    : leveledUp
    ? 'levelUp'
    : isPractice
    ? 'lessonPractice'
    : isQuiz
    ? 'quizDone'
    : perfect
    ? 'lessonPerfect'
    : 'lessonDone';
  const talk = useMemo(() => say(talkKind), [talkKind]);

  const h1 = failedCheckpoint
    ? 'Ще не корона'
    : isCheckpoint
    ? '👑 Корона твоя!'
    : perfect
    ? 'Ідеально!'
    : isPractice
    ? 'Повторення залічено'
    : isQuiz
    ? 'Квіз пройдено'
    : 'Урок пройдено';

  const sub = failedCheckpoint
    ? `Потрібно 80%, у тебе ${accuracy}%. Буває. Повтори уроки і повертайся.`
    : isCheckpoint
    ? 'Модуль закрито на корону. Це фундамент — далі цікавіше.'
    : perfect
    ? 'Жодної помилки. Ростеш, красава.'
    : isPractice
    ? 'Повторення — половина нагороди, але пам’ять дякує.'
    : 'Норм. Помилки — частина процесу.';

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.center}>
        <View style={{ width: '100%', marginBottom: 6 }}>
          <GrindykSay text={talk.text} pose={talk.pose} height={120} />
        </View>
        <Text style={styles.h1}>{h1}</Text>
        <Text style={styles.muted}>{sub}</Text>

        {leveledUp && (
          <Animated.View style={[styles.levelUp, { transform: [{ scale }] }]}>
            <Text style={{ fontSize: 34 }}>🚀</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.levelUpTitle}>LEVEL UP! Тепер Lvl {level}</Text>
              <Text style={styles.achSub}>Гріндік прокачався. Так тримати.</Text>
            </View>
          </Animated.View>
        )}

        {perfect && !failedCheckpoint && !isPractice && (
          <View style={styles.ach}>
            <Text style={{ fontSize: 36 }}>😎</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.achTitle}>Бездоганний урок!</Text>
              <Text style={styles.achSub}>Ексклюзивна нагорода за чистий прохід.</Text>
            </View>
          </View>
        )}

        {!failedCheckpoint && (
          <View style={styles.rewardRow}>
            <View style={styles.rewardItem}>
              <Icon name="coin" size={34} />
              <Text style={styles.reward}>+{coins}</Text>
            </View>
            <View style={styles.rewardItem}>
              <Icon name="xp" size={34} />
              <Text style={[styles.reward, { color: C.blue }]}>+{xp} XP</Text>
            </View>
          </View>
        )}
      </View>

      <View style={{ width: '100%' }}>
        <Row label="Вірних відповідей" value={`${correct}`} color={C.accent} />
        <Row label="Помилок" value={`${errors}`} color={errors ? C.red : C.accent} />
        <Row label="Точність" value={`${accuracy}%`} color={C.txt} />
        <Row label="Макс. комбо-бонус" value={`+${maxBonus}%`} color={C.fire} />
        {isQuiz && <Row label="Бонус за швидкість" value={`+${speed} 🪙`} color={C.blue} />}
      </View>

      <View style={styles.nextBox}>
        <Text style={styles.nextTxt}>
          {failedCheckpoint
            ? 'Повтори будь-який урок (🔁 practice) і спробуй знову.'
            : isQuiz
            ? 'Квіз пройдено. Повертайся на шлях і продовжуй!'
            : next
            ? `Наступний: ${next.code} · ${next.title}`
            : 'Усі доступні модулі пройдено! Нові — скоро 🎯'}
        </Text>
      </View>

      <Button
        title={failedCheckpoint ? 'Повернутись' : 'Забрати нагороду'}
        onPress={() => router.replace('/home')}
      />
    </View>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 22, justifyContent: 'space-between' },
  center: { alignItems: 'center' },
  emoji: { fontSize: 60 },
  h1: { color: C.txt, fontSize: 26, fontWeight: '800', marginTop: 8 },
  muted: { color: C.muted, fontSize: 14, marginTop: 6, textAlign: 'center' },
  levelUp: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    backgroundColor: 'rgba(90,167,255,0.12)',
    borderColor: C.blue,
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    width: '100%',
    borderBottomWidth: 5,
    borderBottomColor: C.blueEdge,
  },
  levelUpTitle: { color: C.blue, fontWeight: '800', fontSize: 15 },
  ach: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    backgroundColor: C.panel,
    borderColor: C.gold,
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    width: '100%',
    borderBottomWidth: 5,
    borderBottomColor: C.goldEdge,
  },
  achTitle: { color: C.txt, fontWeight: '800', fontSize: 15 },
  achSub: { color: C.muted, fontSize: 13, marginTop: 2 },
  rewardRow: { flexDirection: 'row', gap: 22, marginVertical: 16 },
  rewardItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reward: { color: C.gold, fontSize: 26, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomColor: C.line,
    borderBottomWidth: 1,
  },
  rowLabel: { color: C.txt, fontSize: 15 },
  rowValue: { fontSize: 15, fontWeight: '800' },
  nextBox: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginVertical: 14,
    borderBottomWidth: 5,
  },
  nextTxt: { color: C.txt, fontSize: 15, textAlign: 'center' },
});
