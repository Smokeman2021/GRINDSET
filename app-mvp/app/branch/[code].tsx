// Гілка вертикалі (ТЗ 004, C1): вступ, два входи («Почати з основ» / «Перевірити себе»), результат самоперевірки,
// практика, уроки й фінал. Пропущені уроки лишаються непройденими; фінал зараховується й нагороджується один раз.
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBranch, readyLessonIds } from '../../src/data/branches';
import { finalOpen, nextUnit, PART_LABEL } from '../../src/data/branchRules';
import { ENERGY_PER_LESSON, useStore } from '../../src/store';
import { Markdown } from '../../src/components/Markdown';
import { Button } from '../../src/components/Button';
import { FeedbackSheet } from '../../src/components/FeedbackSheet';
import { CLOUD_MODE } from '../../src/cloud/config';
import { Theme, useStyles, useTheme } from '../../src/theme';

export default function BranchScreen() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();
  const b = getBranch(String(code ?? '').toUpperCase());
  const completed = useStore((s) => s.completed);
  const prog = useStore((s) => (b ? s.branchProg[b.code] : undefined));
  const lang = useStore((s) => s.lang);
  const energy = useStore((s) => s.energy);
  const strictEnergy = useStore((s) => s.strictEnergy);
  const simStep = useStore((s) => s.simLeads?.step ?? 0);
  const [introOpen, setIntroOpen] = React.useState(false);
  const [feedbackOpen, setFeedbackOpen] = React.useState(false);

  if (!b) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 20, padding: 20 }]}>
        <Text style={styles.h1}>Гілку не знайдено</Text>
        <Button title="До вертикалей" onPress={() => router.dismissTo('/home')} />
      </View>
    );
  }

  const ready = readyLessonIds(b);
  const started = !!prog?.started || [...b.lessons.map((l) => l.id), b.practice.id].some((id) => completed.includes(id));
  const showIntro = !started || introOpen;
  const isFinalOpen = finalOpen(b.code, completed, prog);
  const finalDone = completed.includes(`BR-${b.code}-FINAL`);
  const next = nextUnit(b.code, completed, prog, ready, !!b.final?.ready);
  const open = (id: string) => {
    if (strictEnergy && energy < ENERGY_PER_LESSON && !completed.includes(id) && !id.endsWith('-SC')) {
      router.navigate('/shop');
      return;
    }
    useStore.getState().setBranchProg(b.code, { started: true });
    // фінал товарки — тренажер «Ліди» (етап D): власний екран
    if (id === b.final?.id && b.final.sim === 'leads') return router.push('/leads');
    router.push(`/lesson/${id}`);
  };
  const lessonTitle = (id?: string) => b.lessons.find((l) => l.id === id)?.title;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: insets.top + 10, paddingBottom: insets.bottom + 40, gap: 12 }}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.dismissTo('/home')} accessibilityRole="button" accessibilityLabel="До вертикалей">
            <Text style={styles.back}>← Вертикалі</Text>
          </Pressable>
          {CLOUD_MODE !== 'off' && (
            <Pressable onPress={() => setFeedbackOpen(true)} hitSlop={8} accessibilityLabel="Відгук">
              <Text style={{ fontSize: 20 }}>🐞</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.h1}>
          {b.emoji} {b.title}
        </Text>
        <Text style={styles.muted}>{b.scenario}</Text>
        {lang !== 'uk' && <Text style={styles.note}>Гілка доступна українською. Мову застосунку не змінюємо.</Text>}
        {b.regulated && <Text style={[styles.note, { color: C.goldTxt }]}>Регульована вертикаль · фінал: рішення про допуск, без запуску</Text>}
        {/* етап E: кожна одиниця гілки — точка на карті Києва */}
        <Pressable onPress={() => router.push({ pathname: '/map/[code]', params: { code: b.code } })} style={styles.mapBtn} accessibilityRole="button" accessibilityLabel="Карта Києва">
          <Text style={styles.mapBtnTxt}>🗺 Карта Києва · {b.title}</Text>
          <Text style={styles.mapBtnSub}>уроки, практика й фінал як заклади на карті</Text>
        </Pressable>

        {showIntro ? (
          <View style={styles.card}>
            <Text style={styles.kicker}>ВСТУП · ЩО НА ТЕБЕ ЧЕКАЄ</Text>
            <Markdown text={b.intro} />
            <View style={{ height: 8 }} />
            <Markdown text={b.wgb} />
            <Pressable onPress={() => router.push({ pathname: '/kb/[id]', params: { id: b.kbCard } })} style={styles.linkBtn} accessibilityRole="link">
              <Text style={styles.link}>Детальніше про вертикаль →</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setIntroOpen(true)}>
            <Text style={styles.link}>Вступ і білий / сірий / чорний →</Text>
          </Pressable>
        )}

        {/* Два входи */}
        {!prog?.sc && (
          <View style={{ gap: 10 }}>
            <Button title="Почати з основ" onPress={() => open(b.lessons[0].id)} disabled={!b.lessons[0].ready} />
            <Button title="Перевірити себе · 2 завдання" ghost onPress={() => open(`BR-${b.code}-SC`)} />
            {!b.lessons[0].ready && <Text style={styles.muted}>Уроки цієї гілки ще конвертуються у форми з перевіркою; самоперевірка й практика вже працюють.</Text>}
          </View>
        )}

        {/* Результат самоперевірки */}
        {prog?.sc === 'pass' && !prog.practice && (
          <View style={[styles.card, { borderColor: C.accent }]}>
            <Text style={styles.kicker}>САМОПЕРЕВІРКА · ОБИДВА ВІРНО</Text>
            <Text style={styles.body}>Можна почати з першого уроку або одразу перейти до практики: одне коротке завдання на навичку, якої не було в двох питаннях. Пропущені уроки лишаються непройденими й без нагород.</Text>
            <View style={{ gap: 10, marginTop: 10 }}>
              <Button title="Почати з першого уроку" ghost onPress={() => open(b.lessons[0].id)} disabled={!b.lessons[0].ready} />
              <Button title="Перейти до практики" onPress={() => open(b.practice.id)} />
            </View>
          </View>
        )}
        {prog?.sc === 'fail' && (
          <View style={[styles.card, { borderColor: C.red }]}>
            <Text style={[styles.kicker, { color: C.redTxt }]}>САМОПЕРЕВІРКА · Є ПОМИЛКА</Text>
            {prog.scWhy ? <Text style={styles.body}>{prog.scWhy}</Text> : null}
            <View style={{ gap: 10, marginTop: 10 }}>
              {prog.scSee && (
                <Button title={`Відкрити урок: ${lessonTitle(prog.scSee) ?? prog.scSee}`} onPress={() => open(prog.scSee!)} disabled={!b.lessons.find((l) => l.id === prog.scSee)?.ready} />
              )}
              <Button title="Пройти самоперевірку ще раз" ghost onPress={() => open(`BR-${b.code}-SC`)} />
            </View>
          </View>
        )}

        {/* Практика */}
        {prog?.practice === 'fail' && (
          <View style={[styles.card, { borderColor: C.red }]}>
            <Text style={[styles.kicker, { color: C.redTxt }]}>ПРАКТИКА · НЕ ЗАРАХОВАНО</Text>
            {prog.prWhy ? <Text style={styles.body}>{prog.prWhy}</Text> : null}
            <View style={{ gap: 10, marginTop: 10 }}>
              {prog.prSee && <Button title={`Урок, де це розбирається: ${lessonTitle(prog.prSee) ?? prog.prSee}`} onPress={() => open(prog.prSee!)} disabled={!b.lessons.find((l) => l.id === prog.prSee)?.ready} />}
              <Button title="Спробувати практику ще раз" ghost onPress={() => open(b.practice.id)} />
            </View>
          </View>
        )}
        {prog?.practice === 'pass' && <Text style={[styles.note, { color: C.accentTxt }]}>{b.final?.ready ? '✓ Практику зараховано: фінал відкрито.' : '✓ Практику зараховано.'}</Text>}

        {/* Прогалини фіналу */}
        {!finalDone && (prog?.finalGaps?.length || prog?.blocked) ? (
          <View style={[styles.card, { borderColor: C.red }]}>
            <Text style={[styles.kicker, { color: C.redTxt }]}>ФІНАЛ · НЕ ЗАРАХОВАНО</Text>
            {prog.blocked && <Text style={styles.body}>⛔ Рішення «запускати» без підтвердженого допуску блокує зарахування фіналу. Виправ рішення.</Text>}
            {(prog.finalGaps ?? []).map((g) => (
              <View key={g.part} style={{ marginTop: 8 }}>
                <Text style={styles.gapTitle}>{PART_LABEL[g.part]}</Text>
                <Text style={styles.body}>{g.why}</Text>
                {g.see && (
                  <Pressable onPress={() => open(g.see!)} disabled={!b.lessons.find((l) => l.id === g.see)?.ready}>
                    <Text style={styles.link}>Урок: {lessonTitle(g.see) ?? g.see} →</Text>
                  </Pressable>
                )}
              </View>
            ))}
            <View style={{ marginTop: 10 }}>
              <Button title="Повторити фінал" onPress={() => open(`BR-${b.code}-FINAL`)} />
            </View>
          </View>
        ) : null}

        {/* Шлях гілки */}
        <Text style={styles.section}>Шлях гілки</Text>
        {b.lessons.map((l, i) => {
          const done = completed.includes(l.id);
          const isNext = next === l.id;
          return (
            <Pressable
              key={l.id}
              disabled={!l.ready}
              onPress={() => open(l.id)}
              style={[styles.row, !l.ready && styles.rowGrey, isNext && { borderColor: C.accent }]}
              accessibilityRole="button"
              accessibilityState={{ disabled: !l.ready }}
            >
              <Text style={[styles.rowNum, done && { color: C.accentTxt }]}>{done ? '✓' : i + 1}</Text>
              <Text style={[styles.rowTxt, !l.ready && { color: C.disabledTxt }]}>{l.title}</Text>
              {done && <Text style={styles.rowTag}>🔁</Text>}
            </Pressable>
          );
        })}
        {prog?.sc === 'pass' && (
          <Pressable onPress={() => open(b.practice.id)} style={[styles.row, prog.practice !== 'pass' && next === null && { borderColor: C.accent }]}>
            <Text style={[styles.rowNum, prog.practice === 'pass' && { color: C.accentTxt }]}>{prog.practice === 'pass' ? '✓' : '🎯'}</Text>
            <Text style={styles.rowTxt}>{b.practice.title}</Text>
          </Pressable>
        )}
        {b.final ? (
          <Pressable
            disabled={!isFinalOpen || !b.final.ready}
            onPress={() => open(b.final!.id)}
            style={[styles.row, (!isFinalOpen || !b.final.ready) && styles.rowGrey, next === b.final.id && { borderColor: C.gold }]}
          >
            <Text style={[styles.rowNum, finalDone && { color: C.accentTxt }]}>{finalDone ? '✓' : '🏁'}</Text>
            <Text style={[styles.rowTxt, (!isFinalOpen || !b.final.ready) && { color: C.disabledTxt }]}>
              Фінал · {b.final.title}
              {!isFinalOpen ? ' · відкриється після 5 уроків або практики' : b.final.sim && !finalDone && simStep > 0 ? ` · продовжити з кроку ${simStep + 1}` : ''}
            </Text>
          </Pressable>
        ) : (
          <View style={[styles.row, styles.rowGrey]}>
            <Text style={styles.rowNum}>🏁</Text>
            <Text style={[styles.rowTxt, { color: C.disabledTxt }]}>{b.code === 'TOV' ? 'Фінал · тренажер «Ліди» збирається (не зараховується)' : 'Фінал'}</Text>
          </View>
        )}
      </ScrollView>
      <FeedbackSheet visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} context={{ screen: `branch/${b.code}` }} />
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    back: { color: C.blueTxt, fontWeight: '800', fontSize: 15 },
    h1: { color: C.txt, fontSize: 26, fontWeight: '900' },
    muted: { color: C.muted, fontSize: 13 },
    note: { color: C.muted, fontSize: 13, fontWeight: '700' },
    kicker: { color: C.goldTxt, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 6 },
    body: { color: C.txt, fontSize: 15, lineHeight: 21 },
    card: { backgroundColor: C.panel, borderRadius: 16, padding: 14, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line },
    linkBtn: { marginTop: 10 },
    link: { color: C.blueTxt, fontWeight: '800', fontSize: 14 },
    section: { color: C.muted, fontSize: 12, fontWeight: '900', letterSpacing: 1, marginTop: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.panel, borderRadius: 14, padding: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line },
    mapBtn: { backgroundColor: '#ece4d1', borderRadius: 14, padding: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: '#d9ceb4' },
    mapBtnTxt: { color: '#2a2418', fontWeight: '900', fontSize: 15 },
    mapBtnSub: { color: '#6b604a', fontWeight: '700', fontSize: 12 },
    rowGrey: { backgroundColor: C.disabled, borderColor: C.disabledEdge },
    rowNum: { width: 26, textAlign: 'center', color: C.txt, fontWeight: '900', fontSize: 16 },
    rowTxt: { flex: 1, color: C.txt, fontSize: 15, fontWeight: '700' },
    rowTag: { fontSize: 14 },
    gapTitle: { color: C.redTxt, fontWeight: '900', fontSize: 13 },
  });
