import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LESSONS, MODULE_TITLE } from '../src/data/lessons';
import { useStore } from '../src/store';
import { Grindyk } from '../src/components/Grindyk';
import { C } from '../src/theme';

const LEVEL_TITLES = [
  'Щойно дізнався що є арбітраж',
  'Вже читав про це в телеграмі',
  'Злив перший бюджет на навчання',
];

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { charName, charStart, energy, coins, streak, level, completed } = useStore();

  const lvlTitle = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  const nextIndex = LESSONS.findIndex((l) => !completed.includes(l.id));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.course}>FB АРБІТРАЖ</Text>
        <Stat color={C.fire} icon="🔥" value={streak} />
        <Stat color={C.gold} icon="🪙" value={coins} />
        <Stat color={C.accent} icon="⚡" value={energy} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 30 }}>
        <View style={styles.hero}>
          <Grindyk start={level < 2 ? charStart : undefined} mood={level >= 2 ? 'neutral' : undefined} size={72} />
          <Text style={styles.name}>{charName}</Text>
          <Text style={styles.lvl}>
            Lvl {level} — «{lvlTitle}»
          </Text>
        </View>

        <Text style={styles.modtag}>{MODULE_TITLE}</Text>

        {LESSONS.map((l, i) => {
          const done = completed.includes(l.id);
          const current = i === nextIndex;
          const locked = !done && !current;
          const offset = i % 3 === 1 ? 46 : i % 3 === 2 ? -46 : 0;
          return (
            <View key={l.id} style={[styles.row, { transform: [{ translateX: offset }] }]}>
              <Pressable
                disabled={locked}
                onPress={() => router.push(`/lesson/${l.id}`)}
                style={[
                  styles.node,
                  done && styles.nodeDone,
                  current && styles.nodeCur,
                  locked && styles.nodeLock,
                ]}
              >
                <Text style={styles.nodeTxt}>{done ? '✓' : current ? '▶' : '🔒'}</Text>
              </Pressable>
              <Text style={[styles.tag, { transform: [{ translateX: -offset }] }]} numberOfLines={2}>
                {l.code} · {l.title}
              </Text>
            </View>
          );
        })}

        {nextIndex === -1 && (
          <View style={styles.doneBox}>
            <Text style={styles.doneTxt}>🎉 Модуль 01 пройдено повністю. Красава.</Text>
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
  stat: { backgroundColor: C.panel, borderRadius: 12, paddingVertical: 6, paddingHorizontal: 10 },
  hero: { alignItems: 'center', marginVertical: 14 },
  name: { color: C.txt, fontWeight: '800', fontSize: 18, marginTop: 6 },
  lvl: { color: C.gold, fontSize: 13, fontWeight: '700', marginTop: 2 },
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
  row: { flexDirection: 'row', alignItems: 'center', marginVertical: 8, gap: 14 },
  node: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: C.line,
    backgroundColor: C.panel,
  },
  nodeDone: { backgroundColor: C.accent, borderColor: C.accent2 },
  nodeCur: { borderColor: C.accent },
  nodeLock: { opacity: 0.45 },
  nodeTxt: { fontSize: 26, color: C.txt },
  tag: { color: C.muted, fontSize: 13, fontWeight: '600', flex: 1 },
  doneBox: {
    backgroundColor: C.panel,
    borderColor: C.accent,
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  doneTxt: { color: C.txt, fontSize: 15, textAlign: 'center' },
});
