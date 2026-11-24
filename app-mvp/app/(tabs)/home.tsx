import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBranch, readyLessonIds, unitById } from '../../src/data/branches';
import { ACADEMY_HOME, HANDBOOK_SPECIALIZATIONS } from '../../src/data/academy/handbookCourses';
import { continueTarget } from '../../src/data/place';
import { dueKeys, parseKey } from '../../src/data/srs';
import { GOAL_XP, useStore } from '../../src/store';
import { homeSay } from '../../src/data/phrases';
import { GrindykSay } from '../../src/components/GrindykSay';
import { UnsyncedNote } from '../../src/components/UnsyncedNote';
import { Theme, useStyles, useTheme } from '../../src/theme';

const [start, ...verticals] = ACADEMY_HOME;
const sandboxDescription = 'Тестуй рішення на навчальних даних без витрат.';
const examDescription = 'Перевір себе на нових кейсах із розбором.';

export default function Home() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const completed = useStore((s) => s.completed);
  const srs = useStore((s) => s.srs);
  const { energy, xpToday, dailyGoal, daysAway, refreshEnergy } = useStore();
  useFocusEffect(
    React.useCallback(() => {
      refreshEnergy();
    }, [refreshEnergy])
  );
  const placeBox = useStore((s) => s.placeBox);
  const branchProg = useStore((s) => s.branchProg);
  // «Продовжити» (етап E): останнє місце або наступна одиниця останньої гілки
  const candidate = continueTarget(placeBox, {
    completed,
    branchProg,
    ready: (c) => { const b = getBranch(c); return b ? readyLessonIds(b) : []; },
    hasFinal: (c) => !!getBranch(c)?.final?.ready,
    title: (id) => { const r = unitById(id); return r ? `${r.branch.title} · ${r.unit.title}` : undefined; },
    branchTitle: (c) => getBranch(c)?.title,
  });
  const cont = candidate?.kind === 'lesson' && candidate.id.includes('-A2-')
    || candidate?.kind === 'kb' && candidate.id.startsWith('HB-')
    || candidate?.kind === 'branch' && candidate.code.endsWith('-A2') ? candidate : null;
  const goContinue = () => {
    if (!cont) return;
    if (cont.kind === 'kb') return router.push({ pathname: '/kb/[id]', params: { id: cont.id, ret: '1' } });
    if (cont.kind === 'branch') return router.push({ pathname: '/branch/[code]', params: { code: cont.code } });
    const r = unitById(cont.id);
    if (r?.unit.sim === 'leads') return router.push('/leads');
    router.push(`/lesson/${cont.id}`);
  };
  const openBranch = (code: string) => router.push({ pathname: '/branch/[code]', params: { code } });
  const due = [...new Set(dueKeys(srs).map((key) => parseKey(key).lessonId))]
    .filter((id) => id.includes('-A2-') && completed.includes(id));
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
            {cont.kind === 'kb' ? <Text style={styles.contSub}>{cont.back ? `стаття, потім повернення: ${cont.back}` : 'стаття «Бази»'}</Text> : null}
            {cont.kind === 'branch' ? <Text style={styles.contSub}>гілку пройдено · карта Києва</Text> : null}
          </Pressable>
        )}
        {due.length > 0 && (
          <Pressable onPress={() => router.push(`/lesson/${due[0]}`)} style={styles.cont} accessibilityRole="button">
            <Text style={styles.contKick}>ПОВТОРЕННЯ · {due.length}</Text>
            <Text style={styles.contTitle}>{unitById(due[0])?.unit.title ?? 'Повторити матеріал'}</Text>
          </Pressable>
        )}
        <Text style={styles.h1}>Академія</Text>
        <Pressable onPress={() => openBranch(start.code)} style={styles.start} accessibilityRole="button" accessibilityLabel="Старт · безкоштовно" accessibilityHint={start.description}>
          <Text style={styles.startIcon}>{start.emoji}</Text>
          <View style={styles.startText}>
            <Text style={styles.startTitle}>{start.title}</Text>
            <Text style={styles.startLabel}>Безкоштовно</Text>
            <Text style={styles.description}>{start.description}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => router.push('/handbook-sim')} style={styles.specialty} accessibilityRole="button" accessibilityLabel="Пісочниця" accessibilityHint={sandboxDescription}>
          <Text style={styles.specialtyIcon}>🧪</Text>
          <View style={styles.specialtyText}>
            <Text style={styles.title}>Пісочниця</Text>
            <Text style={styles.description}>{sandboxDescription}</Text>
          </View>
        </Pressable>
        <View style={styles.grid}>
          {verticals.map((b, i) => (
            <Pressable
              key={b.code}
              onPress={() => openBranch(b.code)}
              style={({ pressed }) => [styles.card, i % 2 === 1 && styles.cardAlt, pressed && { transform: [{ scale: 0.98 }] }]}
              accessibilityRole="button"
              accessibilityLabel={b.title}
              accessibilityHint={b.description}
            >
              <Text style={styles.emoji}>{b.emoji}</Text>
              <View style={styles.cardText}>
                <Text style={styles.title}>{b.title}</Text>
                <Text style={styles.description}>{b.description}</Text>
              </View>
            </Pressable>
          ))}
        </View>
        <Text style={styles.h1}>Спеціалізації</Text>
        {HANDBOOK_SPECIALIZATIONS.map((b) => (
          <Pressable key={b.code} onPress={() => openBranch(b.code)} style={styles.specialty} accessibilityRole="button" accessibilityLabel={b.title} accessibilityHint={b.description}>
            <Text style={styles.specialtyIcon}>{b.emoji}</Text>
            <View style={styles.specialtyText}>
              <Text style={styles.title}>{b.title}</Text>
              <Text style={styles.description}>{b.description}</Text>
            </View>
          </Pressable>
        ))}
        <Pressable onPress={() => router.push('/handbook-exam')} style={styles.specialty} accessibilityRole="button" accessibilityLabel="Підсумковий іспит" accessibilityHint={examDescription}>
          <Text style={styles.specialtyIcon}>📝</Text>
          <View style={styles.specialtyText}>
            <Text style={styles.title}>Підсумковий іспит</Text>
            <Text style={styles.description}>{examDescription}</Text>
          </View>
        </Pressable>
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
    start: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 94, borderRadius: 18, padding: 16, backgroundColor: C.accentTint, borderWidth: 2, borderColor: C.accent },
    startIcon: { fontSize: 37 },
    startText: { flex: 1, gap: 4 },
    startTitle: { color: C.txt, fontSize: 23, fontWeight: '900' },
    startLabel: { color: C.accentTxt, fontSize: 13, fontWeight: '800' },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    card: {
      flexBasis: '47%',
      flexGrow: 1,
      minHeight: 144,
      backgroundColor: C.panel,
      borderRadius: 16,
      padding: 12,
      borderWidth: 2,
      borderBottomWidth: 5,
      borderColor: C.line,
      justifyContent: 'flex-end',
      alignItems: 'flex-start',
      gap: 8,
    },
    cardAlt: { backgroundColor: C.accentTint },
    cardText: { alignSelf: 'stretch', gap: 4 },
    emoji: { fontSize: 34 },
    title: { color: C.txt, fontSize: 17, fontWeight: '900' },
    description: { color: C.muted, fontSize: 13, lineHeight: 18 },
    specialty: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, borderRadius: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
    specialtyText: { flex: 1, gap: 4 },
    specialtyIcon: { fontSize: 20 },
  });
