// «Уроки» (ТЗ 004, C1): вибір вертикалі. Старий курс (модулі 01–10) з інтерфейсу прибрано: головна веде лише у вісім гілок.
// Подорож Києвом з уроками гілок як точками на карті — етап E (файли src/art/Journey* лишаються в репозиторії).
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRANCHES, volumeLabel } from '../../src/data/branches';
import { GOAL_XP, useStore } from '../../src/store';
import { homeSay } from '../../src/data/phrases';
import { GrindykSay } from '../../src/components/GrindykSay';
import { Theme, useStyles, useTheme } from '../../src/theme';

export default function Home() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const completed = useStore((s) => s.completed);
  const lang = useStore((s) => s.lang);
  const { energy, xpToday, dailyGoal, daysAway, refreshEnergy } = useStore();
  useFocusEffect(
    React.useCallback(() => {
      refreshEnergy();
    }, [refreshEnergy])
  );
  const talk = useMemo(() => homeSay({ daysAway, energy, goalDone: xpToday >= GOAL_XP[dailyGoal], fresh: true }), [daysAway, energy, xpToday, dailyGoal]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, gap: 12 }}>
        <GrindykSay text={talk.text} pose={talk.pose} height={110} />
        <Text style={styles.h1}>Обери вертикаль</Text>
        <Text style={styles.muted}>Кожна гілка: вступ, самоперевірка, уроки й фінал. Можна почати з основ або перевірити себе.</Text>
        <View style={styles.grid}>
          {BRANCHES.map((b) => {
            const units = [...b.lessons.map((l) => l.id), b.practice.id, `BR-${b.code}-FINAL`];
            const done = units.filter((id) => completed.includes(id)).length;
            return (
              <Pressable
                key={b.code}
                onPress={() => router.push({ pathname: '/branch/[code]', params: { code: b.code } })}
                style={({ pressed }) => [styles.card, pressed && { transform: [{ translateY: 2 }], borderBottomWidth: 2 }]}
                accessibilityRole="button"
                accessibilityLabel={`${b.title}. ${volumeLabel(b)}`}
              >
                <Text style={styles.emoji}>{b.emoji}</Text>
                <Text style={styles.title}>{b.title}</Text>
                <Text style={styles.vol}>{volumeLabel(b)}</Text>
                {b.regulated && <Text style={styles.reg}>фінал: рішення про допуск, без запуску</Text>}
                {done > 0 && <Text style={styles.done}>✓ {done} з {units.length}</Text>}
                {lang !== 'uk' && <Text style={styles.ua}>Відкрити українською</Text>}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    h1: { color: C.txt, fontSize: 24, fontWeight: '900' },
    muted: { color: C.muted, fontSize: 13 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    card: {
      flexBasis: '47%',
      flexGrow: 1,
      backgroundColor: C.panel,
      borderRadius: 16,
      padding: 12,
      borderWidth: 2,
      borderBottomWidth: 5,
      borderColor: C.line,
      gap: 4,
    },
    emoji: { fontSize: 30 },
    title: { color: C.txt, fontSize: 17, fontWeight: '900' },
    vol: { color: C.muted, fontSize: 12, fontWeight: '700' },
    reg: { color: C.goldTxt, fontSize: 11, fontWeight: '700' },
    done: { color: C.accentTxt, fontSize: 12, fontWeight: '800' },
    ua: { color: C.blueTxt, fontSize: 12, fontWeight: '800' },
  });
