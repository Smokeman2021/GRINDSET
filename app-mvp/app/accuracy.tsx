// Рейтинг точності: змагання реальних тестерів. Метрика: правильні / усі відповіді (уроки й квізи).
// Дані дає лише публічна функція сервера (імʼя, %, кількість відповідей); поріг появи 30 відповідей.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Theme, useStyles, useTheme } from '../src/theme';
import { Glow } from '../src/components/Glow';
import { useStore } from '../src/store';
import { getBackend } from '../src/cloud/backend';
import { useCloud } from '../src/cloud/cloudStore';
import { MIN_RATED_ANSWERS } from '../src/cloud/shared/access';
import type { AccuracyRow } from '../src/cloud/types';

export default function Accuracy() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const myTotal = useStore((s) => s.answersTotal);
  const myCorrect = useStore((s) => s.answersCorrect);
  const [rows, setRows] = useState<AccuracyRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const backend = getBackend();
    if (!backend) return;
    setLoading(true);
    setFailed(false);
    try {
      setRows(await backend.accuracyBoard());
    } catch (e) {
      if (e instanceof Error && e.message === 'replaced') void useCloud.getState().verify();
      else setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const myPct = myTotal > 0 ? Math.round((myCorrect / myTotal) * 1000) / 10 : 0;
  const left = Math.max(0, MIN_RATED_ANSWERS - myTotal);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 30 }}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <Text style={styles.backTxt}>‹ Назад</Text>
        </Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroIcon}>🎯</Text>
          <Text style={styles.heroTitle}>Рейтинг точності</Text>
          <Text style={styles.heroSub}>Правильні відповіді ÷ усі відповіді (уроки й квізи). Змагаються лише реальні гравці.</Text>
          <Text style={styles.mine}>
            Твоя точність: {myTotal > 0 ? `${myPct}%` : '—'} · відповідей: {myTotal}
          </Text>
          {left > 0 && <Text style={styles.hint}>У рейтингу ти з’явишся після {MIN_RATED_ANSWERS} відповідей: лишилось {left}.</Text>}
        </View>

        {loading && !rows && <ActivityIndicator color={C.accent} style={{ marginTop: 24 }} />}

        {failed && (
          <View style={styles.box}>
            <Text style={styles.boxTxt}>Не вдалося завантажити рейтинг. Перевір інтернет.</Text>
          </View>
        )}

        {rows && rows.length === 0 && (
          <View style={styles.box}>
            <Text style={styles.boxTxt}>Поки що порожньо: у рейтинг потрапляють гравці від {MIN_RATED_ANSWERS} відповідей.</Text>
          </View>
        )}

        {rows && rows.length > 0 && (
          <View style={{ marginTop: 8 }}>
            {rows.map((r, i) => (
              <View key={r.name + i} style={[styles.row, r.isMe && styles.rowMe]}>
                <Text style={[styles.pos, i === 0 && { color: C.goldTxt }]}>{i + 1}</Text>
                <View style={[styles.dot, r.isMe && { backgroundColor: C.accent }]}>
                  <Text style={styles.dotTxt}>{r.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, r.isMe && { color: C.accentTxt }]} numberOfLines={1}>
                    {r.name}
                    {r.isMe ? ' (ти)' : ''}
                  </Text>
                  <Text style={styles.cnt}>{r.answers} відповідей</Text>
                </View>
                <Text style={styles.pct}>{r.accuracy}%</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable onPress={() => void load()} style={styles.refresh}>
          <Text style={styles.refreshTxt}>{loading ? 'Оновлюємо…' : '↻ Оновити'}</Text>
        </Pressable>
        <Text style={styles.foot}>При рівній точності вище той, у кого більше відповідей. Адміни й заблоковані в рейтингу не показуються.</Text>
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    back: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 6 },
    backTxt: { color: C.accentTxt, fontWeight: '800', fontSize: 15 },
    hero: { alignItems: 'center', backgroundColor: C.panel, borderRadius: 20, borderWidth: 2, borderBottomWidth: 5, borderColor: C.line, padding: 18 },
    heroIcon: { fontSize: 44 },
    heroTitle: { color: C.txt, fontSize: 22, fontWeight: '900', marginTop: 4 },
    heroSub: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 6 },
    mine: { color: C.txt, fontWeight: '800', marginTop: 10 },
    hint: { color: C.goldTxt, fontSize: 12, fontWeight: '700', marginTop: 6, textAlign: 'center' },
    box: { marginTop: 16, backgroundColor: C.panel2, borderRadius: 14, padding: 14, borderWidth: 2, borderColor: C.line },
    boxTxt: { color: C.txt, textAlign: 'center', fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.panel, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 6, borderWidth: 2, borderColor: 'transparent' },
    rowMe: { borderColor: C.accent, backgroundColor: C.chip },
    pos: { width: 24, color: C.muted, fontWeight: '900', fontSize: 15, textAlign: 'center' },
    dot: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
    dotTxt: { color: C.txt, fontWeight: '900' },
    name: { color: C.txt, fontWeight: '700', fontSize: 15 },
    cnt: { color: C.muted, fontSize: 11, marginTop: 1 },
    pct: { color: C.accentTxt, fontWeight: '900', fontSize: 16 },
    refresh: { alignSelf: 'center', marginTop: 14, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, backgroundColor: C.panel, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line },
    refreshTxt: { color: C.txt, fontWeight: '800' },
    foot: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 14 },
  });
