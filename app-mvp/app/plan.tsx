import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { GrindykSay } from '../src/components/GrindykSay';
import { buildPlan } from '../src/data/plan';
import { FUTURE_ROUTES } from '../src/data/quiz';
import { useStore } from '../src/store';
import { C } from '../src/theme';

const TAG: Record<string, { label: string; color: string }> = {
  core: { label: 'Основа', color: C.blue },
  focus: { label: '🎯 Фокус', color: C.gold },
  skip: { label: 'Можна пропустити', color: C.muted },
};

// Особистий маршрут після опитування: короткий підсумок, модулі з поясненням і затемнені майбутні напрямки
export default function Plan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const quiz = useStore((s) => s.quiz);
  const onboarded = useStore((s) => s.onboarded);
  const plan = useMemo(() => buildPlan(quiz), [quiz]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 22, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 30 }}>
      <GrindykSay text="Склав тобі маршрут. Порядок лінійний, я лише підказую, що важливе, а що можна пропустити." pose="point" height={130} />
      <Text style={styles.h1}>Твій маршрут</Text>
      <Text style={styles.sum}>{plan.summary}</Text>

      {plan.items.map((it, i) => (
        <View key={it.moduleId} style={[styles.card, it.tag === 'skip' && { opacity: 0.6 }, it.tag === 'focus' && { borderColor: C.gold }]}>
          <View style={styles.row}>
            <Text style={styles.num}>{i + 1}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{it.title}</Text>
              <Text style={styles.reason}>{it.reason}</Text>
            </View>
            <Text style={[styles.tag, { color: TAG[it.tag].color }]}>{TAG[it.tag].label}</Text>
          </View>
        </View>
      ))}

      <Text style={styles.h2}>Далі, після бази</Text>
      <View style={styles.future}>
        {FUTURE_ROUTES.map((r) => (
          <View key={r.title} style={styles.fCard}>
            <Text style={{ fontSize: 24 }}>{r.emoji}</Text>
            <Text style={styles.fTitle}>{r.title}</Text>
            <Text style={styles.fNote}>{r.note}</Text>
          </View>
        ))}
      </View>

      <View style={{ marginTop: 20 }}>
        <Button title={onboarded ? 'До діагностики' : 'Далі'} onPress={() => router.replace('/diagnostic')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  h1: { color: C.txt, fontSize: 26, fontWeight: '900', marginTop: 12 },
  sum: { color: C.gold, fontWeight: '800', marginTop: 4, marginBottom: 12 },
  card: { backgroundColor: C.panel, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 2, borderColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  num: { color: C.muted, fontWeight: '900', width: 22, textAlign: 'center' },
  title: { color: C.txt, fontWeight: '800', fontSize: 14 },
  reason: { color: C.muted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  tag: { fontWeight: '800', fontSize: 11, maxWidth: 90, textAlign: 'right' },
  h2: { color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 1, marginTop: 20, marginBottom: 10, textTransform: 'uppercase' },
  future: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  fCard: { width: '31%', flexGrow: 1, backgroundColor: C.panel, borderRadius: 14, padding: 12, alignItems: 'center', opacity: 0.45, borderWidth: 2, borderColor: C.line },
  fTitle: { color: C.txt, fontWeight: '800', marginTop: 4 },
  fNote: { color: C.muted, fontSize: 10, marginTop: 2, textAlign: 'center' },
});
