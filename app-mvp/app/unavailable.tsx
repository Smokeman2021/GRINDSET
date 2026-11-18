// Недійсне пряме посилання (ТЗ 006, 2.3): такого уроку чи статті немає або вони недоступні. Перехід до доступного навчання.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Theme, useStyles } from '../src/theme';
import { Button } from '../src/components/Button';
import { GrindykSay } from '../src/components/GrindykSay';

const WHY: Record<string, string> = {
  kb: 'Такої статті в «Базі» немає.',
  lesson: 'Такого уроку немає або він ще недоступний.',
  branch: 'Такої вертикалі немає.',
  route: 'За цим посиланням нічого немає.',
};

export default function Unavailable() {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { why } = useLocalSearchParams<{ why?: string }>();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }]}>
      <GrindykSay text="Посилання веде в нікуди. Буває. Вертаймось туди, де є що вчити." pose="think" height={100} />
      <Text style={styles.h1}>Посилання не відкривається</Text>
      <Text style={styles.txt}>{WHY[why ?? ''] ?? WHY.route} Твій прогрес на місці.</Text>
      <View style={{ gap: 10, marginTop: 'auto' }}>
        <Button title="▶ До навчання" onPress={() => router.replace('/home')} />
        <Button title="«База»" ghost onPress={() => router.replace('/library')} />
      </View>
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 20 },
    h1: { color: C.txt, fontSize: 22, fontWeight: '900', marginTop: 16 },
    txt: { color: C.muted, fontSize: 15, lineHeight: 22, marginTop: 8 },
  });
