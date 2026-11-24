import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { getBackend } from '../../src/cloud/backend';
import { useCloud } from '../../src/cloud/cloudStore';
import type { LeagueRoster } from '../../src/cloud/types';
import { Glow } from '../../src/components/Glow';
import { TopBar } from '../../src/components/TopBar';
import { useT } from '../../src/i18n';
import { Theme, useStyles, useTheme } from '../../src/theme';

type ViewState = { state: 'loading' | 'offline' | 'pending' | 'error' } | { state: 'ready'; roster: LeagueRoster };

export default function League() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const [screen, setScreen] = useState<ViewState>({ state: 'loading' });
  const [refresh, setRefresh] = useState(0);

  useFocusEffect(useCallback(() => {
    const backend = getBackend();
    if (!backend) {
      setScreen({ state: 'offline' });
      return;
    }
    let active = true;
    setScreen({ state: 'loading' });
    backend.weeklyRoster().then(
      (roster) => { if (active) setScreen(roster ? { state: 'ready', roster } : { state: 'pending' }); },
      (error) => {
        if (!active) return;
        if (error instanceof Error && error.message === 'replaced') void useCloud.getState().verify();
        setScreen({ state: 'error' });
      },
    );
    return () => { active = false; };
  }, [refresh]));

  const players = screen.state === 'ready' ? screen.roster.players : [];
  const week = screen.state === 'ready' ? screen.roster.weekStart.slice(5).split('-').reverse().join('.') : null;

  return (
    <View style={styles.root}>
      <Glow />
      <TopBar title={t('titleLeague')} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30, gap: 16 }}>
        <View style={styles.hero}>
          <Text style={styles.title}>Тижнева ліга</Text>
          {week && <Text style={styles.muted}>Тиждень від {week} · учасників: {players.length}</Text>}
          <Text style={styles.muted}>Тут видно всіх учасників, зокрема тих, хто ще має 0 балів. Нарахування балів готуємо.</Text>
        </View>

        {screen.state === 'loading' && <ActivityIndicator color={C.accent} accessibilityLabel="Завантажуємо учасників" />}
        {screen.state === 'pending' && <Text style={styles.muted}>Список учасників ще підключається.</Text>}
        {screen.state === 'offline' && <Text style={styles.muted}>Список учасників доступний після входу в GRINDSET.</Text>}
        {screen.state === 'error' && (
          <View style={styles.list}>
            <Text style={styles.muted}>Не вдалося завантажити учасників.</Text>
            <Pressable accessibilityRole="button" onPress={() => setRefresh((n) => n + 1)} style={styles.action}>
              <Text style={styles.link}>Спробувати ще раз</Text>
            </Pressable>
          </View>
        )}

        {screen.state === 'ready' && (players.length ? (
          <View style={styles.list}>
            {players.map((player, index) => (
              <View key={`${player.name}-${index}`} style={[styles.row, player.isMe && styles.me]}>
                <Text style={styles.name} numberOfLines={1}>{player.name}{player.isMe ? ' (ти)' : ''}</Text>
                <Text style={styles.points}>{player.points} балів</Text>
              </View>
            ))}
          </View>
        ) : <Text style={styles.muted}>Поки немає активних учасників.</Text>)}

        <Pressable accessibilityRole="button" onPress={() => router.push('/accuracy')} style={styles.action}>
          <Text style={styles.link}>Моя точність ›</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  hero: { padding: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, gap: 8 },
  title: { color: C.txt, fontSize: 22, fontWeight: '900' },
  muted: { color: C.muted, fontSize: 14, lineHeight: 20 },
  list: { gap: 8 },
  row: { padding: 12, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel, flexDirection: 'row', alignItems: 'center', gap: 12 },
  me: { borderColor: C.accent, backgroundColor: C.accentTint },
  name: { flex: 1, color: C.txt, fontSize: 15, fontWeight: '700' },
  points: { color: C.blueTxt, fontSize: 14, fontWeight: '800' },
  action: { padding: 12, borderRadius: 12, backgroundColor: C.panel },
  link: { color: C.accentTxt, fontSize: 15, fontWeight: '800' },
});
