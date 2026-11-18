// «Уроки» (ТЗ 004, C1): вибір вертикалі. Старий курс (модулі 01–10) з інтерфейсу прибрано: головна веде лише у вісім гілок.
// Подорож Києвом з уроками гілок як точками на карті — етап E (файли src/art/Journey* лишаються в репозиторії).
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRANCHES, getBranch, readyLessonIds, unitById, volumeLabel } from '../../src/data/branches';
import { continueTarget } from '../../src/data/place';
import { GOAL_XP, useStore } from '../../src/store';
import { homeSay } from '../../src/data/phrases';
import { GrindykSay } from '../../src/components/GrindykSay';
import { UnsyncedNote } from '../../src/components/UnsyncedNote';
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
  const placeBox = useStore((s) => s.placeBox);
  const branchProg = useStore((s) => s.branchProg);
  // «Продовжити» (етап E): останнє місце або наступна одиниця останньої гілки
  const cont = continueTarget(placeBox, {
    completed,
    branchProg,
    ready: (c) => { const b = getBranch(c); return b ? readyLessonIds(b) : []; },
    hasFinal: (c) => !!getBranch(c)?.final?.ready,
    title: (id) => { const r = unitById(id); return r ? `${r.branch.title} · ${r.unit.title}` : undefined; },
    branchTitle: (c) => getBranch(c)?.title,
  });
  const goContinue = () => {
    if (!cont) return;
    if (cont.kind === 'sim') return router.push('/leads');
    if (cont.kind === 'kb') return router.push({ pathname: '/kb/[id]', params: { id: cont.id, ret: '1' } });
    if (cont.kind === 'branch') return router.push({ pathname: '/map/[code]', params: { code: cont.code } });
    const r = unitById(cont.id);
    if (r?.unit.sim === 'leads') return router.push('/leads');
    router.push(`/lesson/${cont.id}`);
  };
  const talk = useMemo(() => homeSay({ daysAway, energy, goalDone: xpToday >= GOAL_XP[dailyGoal], fresh: true }), [daysAway, energy, xpToday, dailyGoal]);

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, gap: 12 }}>
        <GrindykSay text={talk.text} pose={talk.pose} height={110} />
        <UnsyncedNote />
        {cont && (
          <Pressable onPress={goContinue} style={({ pressed }) => [styles.cont, pressed && { transform: [{ translateY: 2 }], borderBottomWidth: 2 }]} accessibilityRole="button" accessibilityLabel={`Продовжити: ${cont.label}`}>
            <Text style={styles.contKick}>▶ ПРОДОВЖИТИ</Text>
            <Text style={styles.contTitle} numberOfLines={2}>
              {cont.label}
            </Text>
            {cont.kind === 'lesson' && cont.step ? <Text style={styles.contSub}>з місця, де зупинився: {cont.step}</Text> : null}
            {cont.kind === 'lesson' && !cont.step ? <Text style={styles.contSub}>наступне завдання гілки</Text> : null}
            {cont.kind === 'sim' ? <Text style={styles.contSub}>тренажер, {cont.step}</Text> : null}
            {cont.kind === 'kb' ? <Text style={styles.contSub}>{cont.back ? `стаття, потім повернення: ${cont.back}` : 'стаття «Бази»'}</Text> : null}
            {cont.kind === 'branch' ? <Text style={styles.contSub}>гілку пройдено · карта Києва</Text> : null}
          </Pressable>
        )}
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
    cont: { backgroundColor: C.accentTint, borderRadius: 16, padding: 14, borderWidth: 2, borderBottomWidth: 5, borderColor: C.accent, gap: 2 },
    contKick: { color: C.accentTxt, fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    contTitle: { color: C.txt, fontSize: 17, fontWeight: '900' },
    contSub: { color: C.muted, fontSize: 12, fontWeight: '700' },
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
