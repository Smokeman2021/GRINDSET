import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BM_SCREENS, bmSectionLabel } from '../../src/data/bm';
import { GrindykSay } from '../../src/components/GrindykSay';
import { cardShadow, Theme, useStyles, useTheme } from '../../src/theme';

export default function BmMap() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const bySection = useMemo(() => {
    const order: string[] = [];
    const map = new Map<string, typeof BM_SCREENS>();
    for (const s of BM_SCREENS) {
      if (!map.has(s.section)) {
        map.set(s.section, []);
        order.push(s.section);
      }
      map.get(s.section)!.push(s);
    }
    return order.map((section) => [section, map.get(section)!] as const);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.head, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.x}>✕</Text>
        </Pressable>
        <Text style={styles.headTitle}>Карта кабінету</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}>
        <GrindykSay text="Справжні екрани Facebook Ads Manager — обирай розділ і тренуйся на реальному вигляді кабінету." pose="point" height={100} />

        {bySection.map(([section, screens]) => (
          <View key={section} style={{ marginTop: 18 }}>
            <Text style={styles.sectionTitle}>{bmSectionLabel(section)}</Text>
            {screens.map((s) => (
              <Pressable key={s.id} onPress={() => router.push(`/bm/${s.id}`)} style={styles.row}>
                <Text style={styles.rowTitle}>{s.title}</Text>
                <Text style={styles.arrow}>→</Text>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12, borderBottomColor: C.line, borderBottomWidth: 1 },
    x: { color: C.muted, fontSize: 22, fontWeight: '700' },
    headTitle: { color: C.txt, fontWeight: '900', fontSize: 16, flex: 1 },
    sectionTitle: { color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: C.panel,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 14,
      marginBottom: 6,
      borderWidth: 2,
      borderColor: C.line,
      ...cardShadow(C, 'sm'),
    },
    rowTitle: { color: C.txt, fontWeight: '700', fontSize: 14, flex: 1 },
    arrow: { color: C.muted, fontSize: 14 },
  });
