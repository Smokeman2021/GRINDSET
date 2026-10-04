import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { cardShadow, Theme, useStyles, useTheme } from '../theme';
import { Icon, IconName } from './Icon';
import { UI_BUILD } from '../version';

// Верхня панель показників: стрік, XP, коїни, енергія. Тап по коїнах/енергії веде в магазин.
export function TopBar({ title = 'FB АРБІТРАЖ' }: { title?: string }) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { streak, xp, coins, energy } = useStore();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 10 }]}>
      <Text style={styles.ver}>b{UI_BUILD}</Text>
      <Text style={styles.course}>{title}</Text>
      <Stat color={C.fireTxt} icon="streak" value={streak} />
      <Stat color={C.blueTxt} icon="xp" value={xp} />
      <Stat color={C.goldTxt} icon="coin" value={coins} onPress={() => router.navigate('/shop')} />
      <Stat color={C.accentTxt} icon="energy" value={energy} onPress={() => router.navigate('/shop')} />
    </View>
  );
}

function Stat({ icon, value, color, onPress }: { icon: IconName; value: number; color: string; onPress?: () => void }) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.stat}>
      <Icon name={icon} size={22} />
      <Text style={{ color, fontWeight: '800', fontSize: 15 }}>{value}</Text>
    </Pressable>
  );
}

const makeStyles = (C: Theme) => StyleSheet.create({
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
  ver: { position: 'absolute', left: 6, top: 2, color: C.muted, opacity: 0.7, fontSize: 8, fontWeight: '800' },
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
    borderBottomColor: C.edge,
    ...cardShadow(C, 'sm'),
  },
});
