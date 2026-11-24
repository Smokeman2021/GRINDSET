import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../src/store';
import { Theme, useStyles } from '../src/theme';

export default function Accuracy() {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const total = useStore((s) => s.answersTotal);
  const correct = useStore((s) => s.answersCorrect);
  const percent = total ? Math.round(correct * 1000 / total) / 10 : null;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 30, gap: 12 }}>
        <Pressable accessibilityRole="button" onPress={() => router.canGoBack() ? router.back() : router.replace('/league')}>
          <Text style={styles.back}>‹ Назад</Text>
        </Pressable>
        <Text style={styles.title}>Моя точність</Text>
        <View style={styles.box}>
          <Text style={styles.pct}>{percent === null ? '—' : `${percent}%`}</Text>
          <Text style={styles.count}>{total ? `Правильні відповіді: ${correct} із ${total}` : 'Тут з’являться результати після першої відповіді.'}</Text>
          <Text style={styles.hint}>Точність — частка правильних відповідей у завданнях.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  back: { color: C.accentTxt, fontSize: 16, fontWeight: '800', paddingVertical: 8 },
  title: { color: C.txt, fontSize: 22, fontWeight: '900' },
  box: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, gap: 8 },
  pct: { color: C.accentTxt, fontSize: 32, fontWeight: '900' },
  count: { color: C.txt, fontSize: 16, fontWeight: '700' },
  hint: { color: C.muted, fontSize: 14, lineHeight: 20 },
});
