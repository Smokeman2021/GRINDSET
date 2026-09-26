import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { TopBar } from '../../src/components/TopBar';
import { GrindykSay } from '../../src/components/GrindykSay';
import { DEMOTE_BOTTOM, LEAGUE_SIZE, PROMOTE_TOP, rankOf, standings, TIERS, weekFraction } from '../../src/data/league';
import { useStore } from '../../src/store';
import { say, PhraseKind } from '../../src/data/phrases';
import { C } from '../../src/theme';

export default function League() {
  const insets = useSafeAreaInsets();
  const { tier, weekId, weekXp, playerName, lastWeek, checkStreak } = useStore();
  const [tick, setTick] = useState(0);

  useFocusEffect(
    React.useCallback(() => {
      checkStreak(); // якщо почався новий тиждень, підіб'є підсумки
      setTick((t) => t + 1);
    }, [checkStreak])
  );

  const frac = weekFraction(weekId);
  const list = useMemo(
    () => standings(weekId, tier, playerName, weekXp, frac),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [weekId, tier, playerName, weekXp, tick]
  );
  const rank = rankOf(list);
  const t = TIERS[tier];

  const kind: PhraseKind = rank <= 3 ? 'leagueTop' : rank > LEAGUE_SIZE - DEMOTE_BOTTOM ? 'leagueBottom' : 'leagueMid';
  const [talk, setTalk] = useState(() => say(kind));
  const daysLeft = Math.max(0, Math.ceil(7 * (1 - frac)));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="РЕЙТИНГ" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}>
        <View style={[styles.hero, { borderColor: t.color }]}>
          <Text style={styles.heroIcon}>{t.icon}</Text>
          <Text style={[styles.heroTier, { color: t.color }]}>Ліга «{t.name}»</Text>
          <Text style={styles.heroSub}>
            Твоє місце: {rank} із {LEAGUE_SIZE} · залишилось {daysLeft} дн.
          </Text>
          <Text style={styles.zoneHint}>
            {tier < TIERS.length - 1 ? `Топ-${PROMOTE_TOP} піднімається. ` : 'Це найвища ліга. '}
            {tier > 0 ? `Останні ${DEMOTE_BOTTOM} опускаються.` : ''}
          </Text>
        </View>

        {lastWeek && (
          <View style={[styles.banner, lastWeek.outcome === 'up' ? styles.bannerUp : lastWeek.outcome === 'down' ? styles.bannerDown : null]}>
            <Text style={styles.bannerTxt}>
              Минулий тиждень: {lastWeek.rank} місце ·{' '}
              {lastWeek.outcome === 'up' ? '⬆️ підвищення' : lastWeek.outcome === 'down' ? '⬇️ пониження' : 'залишився в лізі'}
            </Text>
          </View>
        )}

        <View style={{ marginTop: 8 }}>
          <GrindykSay text={talk.text} pose={talk.pose} height={110} onPress={() => setTalk(say(kind))} />
        </View>

        <View style={styles.list}>
          {list.map((r, i) => {
            const pos = i + 1;
            const up = tier < TIERS.length - 1 && pos <= PROMOTE_TOP;
            const down = tier > 0 && pos > LEAGUE_SIZE - DEMOTE_BOTTOM;
            return (
              <View key={r.name + i} style={[styles.row, r.me && styles.rowMe]}>
                <Text style={[styles.pos, up && { color: C.accent }, down && { color: C.red }]}>{pos}</Text>
                <View style={[styles.dot, r.me && { backgroundColor: C.accent }]}>
                  <Text style={styles.dotTxt}>{r.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={[styles.name, r.me && { color: C.accent }]} numberOfLines={1}>
                  {r.name}
                  {r.me ? ' (ти)' : ''}
                </Text>
                <Text style={styles.xp}>{r.xp} XP</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.foot}>
          Онлайн-суперників ще нема, тому боти в лізі симульовані. Коли з'явиться сервер, тут будуть живі гравці.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    backgroundColor: C.panel,
    borderRadius: 20,
    borderWidth: 2,
    borderBottomWidth: 5,
    padding: 18,
  },
  heroIcon: { fontSize: 48 },
  heroTier: { fontSize: 22, fontWeight: '900', marginTop: 4 },
  heroSub: { color: C.txt, fontWeight: '700', marginTop: 6 },
  zoneHint: { color: C.muted, fontSize: 12, marginTop: 6, textAlign: 'center' },
  banner: {
    marginTop: 12,
    backgroundColor: C.panel2,
    borderRadius: 12,
    padding: 10,
    borderWidth: 2,
    borderColor: C.line,
  },
  bannerUp: { borderColor: C.accent },
  bannerDown: { borderColor: C.red },
  bannerTxt: { color: C.txt, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  list: { marginTop: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.panel,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 6,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rowMe: { borderColor: C.accent, backgroundColor: '#12241a' },
  pos: { width: 24, color: C.muted, fontWeight: '900', fontSize: 15, textAlign: 'center' },
  dot: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
  dotTxt: { color: C.txt, fontWeight: '900' },
  name: { flex: 1, color: C.txt, fontWeight: '700', fontSize: 15 },
  xp: { color: C.blue, fontWeight: '800' },
  foot: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 16 },
});
