import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LESSONS } from '../src/data/lessons';
import { useStore } from '../src/store';
import { Button } from '../src/components/Button';
import { C } from '../src/theme';

export default function Results() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const completeLesson = useStore((s) => s.completeLesson);
  const params = useLocalSearchParams<{
    id: string;
    correct: string;
    errors: string;
    maxBonus: string;
    coins: string;
  }>();

  const correct = Number(params.correct ?? 0);
  const errors = Number(params.errors ?? 0);
  const maxBonus = Number(params.maxBonus ?? 0);
  const coins = Number(params.coins ?? 0);
  const id = params.id ?? '';

  const saved = useRef(false);
  useEffect(() => {
    if (!saved.current && id) {
      saved.current = true;
      completeLesson(id, coins);
    }
  }, [id, coins, completeLesson]);

  const perfect = errors === 0;
  const accuracy = correct + errors > 0 ? Math.round((correct / (correct + errors)) * 100) : 0;

  const curIndex = LESSONS.findIndex((l) => l.id === id);
  const next = LESSONS[curIndex + 1];

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.center}>
        <Text style={styles.emoji}>{perfect ? '🎉' : '✅'}</Text>
        <Text style={styles.h1}>{perfect ? 'Ідеально!' : 'Урок пройдено'}</Text>
        <Text style={styles.muted}>
          {perfect ? 'Жодної помилки. Ростеш, красава.' : 'Норм. Помилки — частина процесу.'}
        </Text>

        {perfect && (
          <View style={styles.ach}>
            <Text style={{ fontSize: 36 }}>😎</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.achTitle}>Бездоганний урок!</Text>
              <Text style={styles.achSub}>Ексклюзивна нагорода за чистий прохід.</Text>
            </View>
          </View>
        )}

        <Text style={styles.reward}>🪙 +{coins}</Text>
      </View>

      <View style={{ width: '100%' }}>
        <Row label="Вірних відповідей" value={`${correct}`} color={C.accent} />
        <Row label="Помилок" value={`${errors}`} color={errors ? C.red : C.accent} />
        <Row label="Точність" value={`${accuracy}%`} color={C.txt} />
        <Row label="Макс. комбо-бонус" value={`+${maxBonus}%`} color={C.fire} />
      </View>

      <View style={styles.nextBox}>
        <Text style={styles.nextTxt}>
          {next ? `Наступний: ${next.code} · ${next.title}` : 'Модуль 01 завершено! 🎯'}
        </Text>
      </View>

      <Button title={`Забрати ${coins} 🪙`} onPress={() => router.replace('/home')} />
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
  ach: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    backgroundColor: C.panel,
    borderColor: C.gold,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    width: '100%',
  },
  achTitle: { color: C.txt, fontWeight: '800', fontSize: 15 },
  achSub: { color: C.muted, fontSize: 13, marginTop: 2 },
  reward: { color: C.gold, fontSize: 30, fontWeight: '800', marginVertical: 16 },
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
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginVertical: 14,
  },
  nextTxt: { color: C.txt, fontSize: 15, textAlign: 'center' },
});
