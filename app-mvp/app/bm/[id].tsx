import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GrindykSay } from '../../src/components/GrindykSay';
import { ScreenHotspot, hotspotFeedback } from '../../src/components/ScreenHotspot';
import { findBmScreen, bmSectionLabel } from '../../src/data/bm';
import { Button } from '../../src/components/Button';
import { Theme, useStyles, useTheme } from '../../src/theme';

export default function BmScreenPage() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const screen = findBmScreen(id ?? '');
  const [picked, setPicked] = useState<string | null>(null);

  if (!screen) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={[styles.head, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.x}>✕</Text>
          </Pressable>
          <Text style={styles.headTitle}>Скоро</Text>
        </View>
        <View style={{ padding: 20 }}>
          <GrindykSay text="Цей екран кабінету ще не знято. Повертайся пізніше." pose="shrug" height={110} />
          <Button title="На карту кабінету" onPress={() => router.replace('/bm')} style={{ marginTop: 16 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.head, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.x}>✕</Text>
        </Pressable>
        <Text style={styles.headTitle} numberOfLines={1}>
          {screen.title}
        </Text>
        <Text style={styles.headSection}>{bmSectionLabel(screen.section)}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}>
        <GrindykSay text={screen.talk} pose="think" height={100} />
        <Text style={styles.task}>{screen.task}</Text>

        <ScreenHotspot
          screen={screen}
          picked={picked}
          onPick={setPicked}
          onNav={(leadsTo) => {
            setPicked(null);
            router.push(`/bm/${leadsTo}`);
          }}
        />

        {picked && <Text style={styles.feedback}>{hotspotFeedback(screen, picked)}</Text>}
        {picked && (
          <Pressable onPress={() => setPicked(null)} style={styles.reset}>
            <Text style={styles.resetTxt}>Спробувати ще раз</Text>
          </Pressable>
        )}

        <Pressable onPress={() => router.push('/bm')} style={styles.mapLink}>
          <Text style={styles.mapLinkTxt}>← На карту кабінету</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12, borderBottomColor: C.line, borderBottomWidth: 1 },
    x: { color: C.muted, fontSize: 22, fontWeight: '700' },
    headTitle: { color: C.txt, fontWeight: '900', fontSize: 15, flex: 1 },
    headSection: { color: C.muted, fontSize: 11, fontWeight: '700' },
    task: { color: C.txt, fontWeight: '800', fontSize: 15, marginTop: 4, marginBottom: 12 },
    feedback: { color: C.txt, fontSize: 13, lineHeight: 19, marginTop: 14, backgroundColor: C.panel2, borderRadius: 10, padding: 12 },
    reset: { alignSelf: 'center', marginTop: 10, paddingVertical: 8, paddingHorizontal: 16 },
    resetTxt: { color: C.blueTxt, fontWeight: '800', fontSize: 13 },
    mapLink: { alignSelf: 'center', marginTop: 20, paddingVertical: 8, paddingHorizontal: 16 },
    mapLinkTxt: { color: C.muted, fontWeight: '700', fontSize: 13 },
  });
