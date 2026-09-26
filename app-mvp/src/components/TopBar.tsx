import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { C } from '../theme';
import { Icon, IconName } from './Icon';

// Верхня панель показників: стрік, XP, коїни, енергія. Тап по коїнах/енергії веде в магазин.
export function TopBar({ title = 'FB АРБІТРАЖ' }: { title?: string }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { streak, xp, coins, energy } = useStore();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.course}>{title}</Text>
      <Stat color={C.fire} icon="streak" value={streak} />
      <Stat color={C.blue} icon="xp" value={xp} />
      <Stat color={C.gold} icon="coin" value={coins} onPress={() => router.navigate('/shop')} />
      <Stat color={C.accent} icon="energy" value={energy} onPress={() => router.navigate('/shop')} />
    </View>
  );
}

function Stat({ icon, value, color, onPress }: { icon: IconName; value: number; color: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.stat}>
      <Icon name={icon} size={22} />
      <Text style={{ color, fontWeight: '800', fontSize: 15 }}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomColor: C.line,
    borderBottomWidth: 1,
    backgroundColor: C.bg,
  },
  course: { color: C.muted, fontWeight: '700', fontSize: 12, marginRight: 'auto' },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.panel,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderBottomWidth: 3,
    borderBottomColor: '#0a0c10',
  },
});
