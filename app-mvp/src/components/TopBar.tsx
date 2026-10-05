import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../store';
import { cardShadow, Theme, useStyles, useTheme } from '../theme';
import { Icon, IconName } from './Icon';
import { SHOW_BUILD, UI_BUILD } from '../version';

// Верхня панель показників: стрік, XP, коїни, енергія. Тап по коїнах/енергії веде в магазин.
export function TopBar({ title = 'FB АРБІТРАЖ' }: { title?: string }) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { streak, xp, coins, energy } = useStore();
  const { width } = useWindowDimensions();
  const compact = width < 400; // 360 px: усе в один рядок, без перенесення
  return (
    <View style={[styles.bar, compact && styles.barCompact, { paddingTop: insets.top + 10 }]}>
      {SHOW_BUILD && <Text style={styles.ver}>b{UI_BUILD}</Text>}
      <Text style={styles.course} numberOfLines={1}>{title}</Text>
      <Stat compact={compact} color={C.fireTxt} icon="streak" value={streak} />
      <Stat compact={compact} color={C.blueTxt} icon="xp" value={xp} />
      <Stat compact={compact} color={C.goldTxt} icon="coin" value={coins} onPress={() => router.navigate('/shop')} />
      <Stat compact={compact} color={C.accentTxt} icon="energy" value={energy} onPress={() => router.navigate('/shop')} />
    </View>
  );
}

function Stat({ icon, value, color, onPress, compact }: { icon: IconName; value: number; color: string; onPress?: () => void; compact?: boolean }) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.stat, compact && styles.statCompact]}>
      <Icon name={icon} size={compact ? 18 : 22} />
      <Text style={{ color, fontWeight: '800', fontSize: compact ? 13 : 15 }} numberOfLines={1}>{value}</Text>
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
  barCompact: { gap: 5, paddingHorizontal: 10 },
  ver: { position: 'absolute', left: 6, top: 2, color: C.muted, opacity: 0.7, fontSize: 8, fontWeight: '800' },
  course: { color: C.muted, fontWeight: '700', fontSize: 12, marginRight: 'auto', flexShrink: 1, minWidth: 0 },
  statCompact: { gap: 3, paddingHorizontal: 6 },
  stat: {
    flexShrink: 0,
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
