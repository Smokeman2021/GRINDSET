import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LESSONS, MODULE_TITLE } from '../src/data/lessons';
import { GOAL_XP, GOAL_LABEL, MAX_STREAK_FREEZES, STREAK_FREEZE_COST, useStore } from '../src/store';
import { C } from '../src/theme';

const BUST = require('../assets/grindyk-bust.png');

const LEVEL_TITLES = [
  'Щойно дізнався що є арбітраж',
  'Вже читав про це в телеграмі',
  'Злив перший бюджет на навчання',
];

const MODULE_LESSONS = LESSONS.filter((l) => l.kind !== 'checkpoint');
const CHECKPOINT = LESSONS.find((l) => l.kind === 'checkpoint');

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    charName,
    energy,
    coins,
    xp,
    xpToday,
    streak,
    streakFreezes,
    dailyGoal,
    level,
    completed,
    buyStreakFreeze,
  } = useStore();

  const lvlTitle = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  const nextIndex = MODULE_LESSONS.findIndex((l) => !completed.includes(l.id));
  const moduleDone = nextIndex === -1;
  const checkpointDone = CHECKPOINT ? completed.includes(CHECKPOINT.id) : false;

  const goalTarget = GOAL_XP[dailyGoal];
  const goalPct = Math.min(1, xpToday / goalTarget);
  const canBuyFreeze = coins >= STREAK_FREEZE_COST && streakFreezes < MAX_STREAK_FREEZES;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.course}>FB АРБІТРАЖ</Text>
        <Stat color={C.fire} icon="🔥" value={streak} />
        <Stat color={C.blue} icon="⭐" value={xp} />
        <Stat color={C.gold} icon="🪙" value={coins} />
        <Stat color={C.accent} icon="⚡" value={energy} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 30 }}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Image source={BUST} style={styles.avatarImg} />
          </View>
          <Text style={styles.name}>{charName}</Text>
          <Text style={styles.lvl}>
            Lvl {level} — «{lvlTitle}»
          </Text>
        </View>

        <View style={styles.goalRow}>
          <View style={styles.goalHead}>
            <Text style={styles.goalLabel}>Ціль дня · {GOAL_LABEL[dailyGoal]}</Text>
            <Text style={styles.goalNum}>
              {Math.min(xpToday, goalTarget)}/{goalTarget} XP
            </Text>
          </View>
          <View style={styles.goalBar}>
            <View style={[styles.goalFill, { width: `${goalPct * 100}%` }]} />
          </View>
        </View>

        <Pressable
          style={styles.freezeRow}
          disabled={!canBuyFreeze}
          onPress={buyStreakFreeze}
        >
          <Text style={styles.freezeTxt}>
            ❄️ Заморозка стріку: {streakFreezes}/{MAX_STREAK_FREEZES}
          </Text>
          {streakFreezes < MAX_STREAK_FREEZES && (
            <Text style={[styles.freezeBuy, !canBuyFreeze && styles.freezeBuyOff]}>
              Купити за {STREAK_FREEZE_COST} 🪙
            </Text>
          )}
        </Pressable>

        <Text style={styles.modtag}>{MODULE_TITLE}</Text>

        {MODULE_LESSONS.map((l, i) => {
          const done = completed.includes(l.id);
          const current = i === nextIndex;
          const locked = !done && !current;
          const offset = i % 3 === 1 ? 46 : i % 3 === 2 ? -46 : 0;
          return (
            <View key={l.id} style={[styles.row, { transform: [{ translateX: offset }] }]}>
              <Pressable
                disabled={locked}
                onPress={() => router.push(`/lesson/${l.id}`)}
                style={({ pressed }) => [
                  styles.node,
                  done && styles.nodeDone,
                  current && styles.nodeCur,
                  locked && styles.nodeLock,
                  pressed && !locked && styles.nodePressed,
                ]}
              >
                <Text style={[styles.nodeTxt, (done || current) && styles.nodeTxtOn]}>
                  {done ? '✓' : current ? '▶' : '🔒'}
                </Text>
              </Pressable>
              <Text style={[styles.tag, { transform: [{ translateX: -offset }] }]} numberOfLines={2}>
                {l.code} · {l.title}
              </Text>
            </View>
          );
        })}

        {CHECKPOINT && (
          <View style={styles.row}>
            <Pressable
              disabled={!moduleDone}
              onPress={() => router.push(`/lesson/${CHECKPOINT.id}`)}
              style={({ pressed }) => [
                styles.node,
                styles.nodeCrown,
                !moduleDone && styles.nodeLock,
                pressed && moduleDone && styles.nodePressed,
              ]}
            >
              <Text style={styles.nodeTxt}>{moduleDone ? '👑' : '🔒'}</Text>
            </Pressable>
            <Text style={styles.tag} numberOfLines={2}>
              {CHECKPOINT.title}
            </Text>
          </View>
        )}

        {checkpointDone && (
          <View style={styles.doneBox}>
            <Text style={styles.doneTxt}>👑 Корона Модуля 01 твоя. Красава.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ icon, value, color }: { icon: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={{ color, fontWeight: '800', fontSize: 15 }}>
        {icon} {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomColor: C.line,
    borderBottomWidth: 1,
  },
  course: { color: C.muted, fontWeight: '700', fontSize: 12, marginRight: 'auto' },
  stat: {
    backgroundColor: C.panel,
    borderRadius: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 3,
    borderBottomColor: '#0a0c10',
  },
  hero: { alignItems: 'center', marginVertical: 14 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    backgroundColor: C.imgBg,
    borderWidth: 3,
    borderColor: C.accent,
    borderBottomWidth: 6,
    borderBottomColor: C.accentEdge,
  },
  avatarImg: { width: '100%', height: '100%' },
  name: { color: C.txt, fontWeight: '800', fontSize: 18, marginTop: 8 },
  lvl: { color: C.gold, fontSize: 13, fontWeight: '700', marginTop: 2 },
  goalRow: { marginBottom: 14 },
  goalHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  goalLabel: { color: C.muted, fontSize: 12, fontWeight: '700' },
  goalNum: { color: C.blue, fontSize: 12, fontWeight: '800' },
  goalBar: { height: 14, backgroundColor: '#191e28', borderRadius: 8, overflow: 'hidden' },
  goalFill: { height: '100%', backgroundColor: C.blue, borderRadius: 8 },
  freezeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.panel,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderBottomWidth: 4,
    borderBottomColor: '#0a0c10',
  },
  freezeTxt: { color: C.txt, fontSize: 13, fontWeight: '700' },
  freezeBuy: { color: C.accent, fontSize: 12, fontWeight: '800' },
  freezeBuyOff: { color: C.muted },
  modtag: {
    alignSelf: 'flex-start',
    color: C.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    backgroundColor: 'rgba(54,226,122,0.1)',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 10,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 9, gap: 14 },
  node: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.panel,
    borderBottomWidth: 7,
    borderBottomColor: '#0a0c10',
  },
  nodeDone: { backgroundColor: C.accent, borderBottomColor: C.accentEdge },
  nodeCur: { backgroundColor: C.accent, borderBottomColor: C.accentEdge },
  nodeLock: { opacity: 0.55 },
  nodeCrown: { backgroundColor: C.gold, borderBottomColor: C.goldEdge },
  nodePressed: { transform: [{ translateY: 4 }], borderBottomWidth: 3 },
  nodeTxt: { fontSize: 26, color: C.txt },
  nodeTxtOn: { color: '#05140a' },
  tag: { color: C.muted, fontSize: 13, fontWeight: '600', flex: 1 },
  doneBox: {
    backgroundColor: C.panel,
    borderColor: C.gold,
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderBottomWidth: 5,
    borderBottomColor: C.goldEdge,
  },
  doneTxt: { color: C.txt, fontSize: 15, textAlign: 'center' },
});
