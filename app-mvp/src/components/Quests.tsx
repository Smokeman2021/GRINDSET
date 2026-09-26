import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { questsForDay } from '../data/quests';
import { useStore } from '../store';
import { C } from '../theme';
import { Icon } from './Icon';

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function Quests() {
  const { questsDate, questProgress, questsClaimed, claimQuest } = useStore();
  const today = todayStr();
  const fresh = questsDate === today;
  const progress = fresh ? questProgress : {};
  const claimed = fresh ? questsClaimed : [];
  const quests = questsForDay(today);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>ЗАВДАННЯ ДНЯ</Text>
      {quests.map((q) => {
        const have = Math.min(progress[q.metric] ?? 0, q.target);
        const done = have >= q.target;
        const isClaimed = claimed.includes(q.id);
        return (
          <View key={q.id} style={styles.row}>
            <Text style={{ fontSize: 24 }}>{q.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.qTitle, isClaimed && { color: C.muted }]}>{q.title}</Text>
              <View style={styles.bar}>
                <View style={[styles.fill, { width: `${(have / q.target) * 100}%`, backgroundColor: done ? C.accent : C.blue }]} />
              </View>
            </View>
            {isClaimed ? (
              <Text style={styles.claimed}>✓</Text>
            ) : (
              <Pressable
                disabled={!done}
                onPress={() => claimQuest(q.id)}
                style={({ pressed }) => [styles.btn, !done && styles.btnOff, pressed && { transform: [{ translateY: 2 }] }]}
              >
                <Text style={[styles.btnTxt, !done && { color: C.muted }]}>{done ? 'Забрати' : `${have}/${q.target}`}</Text>
                <View style={styles.reward}>
                  <Text style={[styles.rewardTxt, !done && { color: C.muted }]}>{q.reward}</Text>
                  <Icon name="coin" size={14} />
                </View>
              </Pressable>
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.panel,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: C.line,
  },
  title: { color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  qTitle: { color: C.txt, fontWeight: '700', fontSize: 14, marginBottom: 5 },
  bar: { height: 8, backgroundColor: '#191e28', borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  btn: {
    minWidth: 76,
    alignItems: 'center',
    backgroundColor: C.panel2,
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: C.accent,
    borderBottomColor: C.accentEdge,
  },
  btnOff: { borderColor: C.line, borderBottomColor: C.line },
  btnTxt: { color: C.accent, fontWeight: '900', fontSize: 12 },
  reward: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rewardTxt: { color: C.gold, fontWeight: '800', fontSize: 12 },
  claimed: { color: C.accent, fontWeight: '900', fontSize: 20, width: 76, textAlign: 'center' },
});
