import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useStore } from '../src/store';
import { Button } from '../src/components/Button';
import { Icon } from '../src/components/Icon';
import { Theme, useStyles, useTheme } from '../src/theme';
import { GrindykSay } from '../src/components/GrindykSay';
import { say, PhraseKind } from '../src/data/phrases';
import { ACHIEVEMENTS } from '../src/data/achievements';
import { readyLessonIds, unitById } from '../src/data/branches';
import { nextUnit } from '../src/data/branchRules';

import { MemeCard } from '../src/components/MemeCard';
import { MEMES } from '../src/data/memes';
import { playSfx } from '../src/sound';
import { Pop } from '../src/components/Anim';
import { Watermark } from '../src/components/Watermark';
import { retryLocalWrite } from '../src/cloud/progressSync';
import { kbGet } from '../src/data/kb';

export default function Results() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const completeLesson = useStore((s) => s.completeLesson);
  const params = useLocalSearchParams<{
    id: string;
    correct: string;
    errors: string;
    maxBonus: string;
    speed: string;
    coins: string;
    xp: string;
    practice: string;
    checkpoint: string;
    passed: string;
    doubled: string;
  }>();

  const correct = Number(params.correct ?? 0);
  const errors = Number(params.errors ?? 0);
  const maxBonus = Number(params.maxBonus ?? 0);
  const speed = Number(params.speed ?? 0);
  const coins = Number(params.coins ?? 0);
  const xp = Number(params.xp ?? 0);
  const id = params.id ?? '';
  const isPractice = params.practice === '1';
  const isCheckpoint = params.checkpoint === '1';
  const passed = params.passed !== '0';

  const isDiagnostic = false; // стару діагностику прибрано разом зі старим курсом (C1.0)
  const isMistakes = false;
  const ref = unitById(id);
  const hub = ref ? `/branch/${ref.branch.code}` : '/home';
  const doubled = params.doubled === '1';
  const [leveledUp, setLeveledUp] = useState(false);
  const [newAch, setNewAch] = useState<string[]>([]);
  const scale = useRef(new Animated.Value(0)).current;

  // Урок вважається записаним, коли операцію записано у сховище пристрою: до цього результат не показуємо
  const [saveState, setSaveState] = useState<'saving' | 'ok' | 'error'>('ok');
  const saved = useRef(false);
  useEffect(() => {
    if (!saved.current && id) {
      saved.current = true;
      const before = useStore.getState().level;
      const streakBefore = useStore.getState().streak;
      const unlockedBefore = useStore.getState().unlocked;
      if (isDiagnostic) {
        // діагностика не дає нагород; ачівка «золоті окуляри» за безпомилковий тест з першої спроби
        useStore.getState().finishDiagnostic(errors === 0 && correct > 0, []);
      } else if (passed) {
        setSaveState('saving');
        completeLesson(id, coins, xp, { correct, errors, doubled, practiceOnly: isMistakes, maxCombo: Math.round(maxBonus / 2), isQuiz: false }).then(
          () => setSaveState('ok'),
          () => setSaveState('error')
        );
      }
      const st = useStore.getState();
      const fresh = st.unlocked.filter((a) => !unlockedBefore.includes(a));
      if (fresh.length) setNewAch(fresh);
      const after = st.level;
      // стрік зріс (перший урок за день): окремий звук трохи після основного
      if (st.streak > streakBefore) setTimeout(() => playSfx('streak'), 700);
      if (after > before) {
        setLeveledUp(true);
        Animated.spring(scale, { toValue: 1, friction: 4, useNativeDriver: true }).start();
        playSfx('levelup');
      } else if (isCheckpoint && passed) {
        playSfx('chest');
      } else if (!isDiagnostic && passed) {
        playSfx('lesson');
      }
    }
  }, [id, coins, xp, passed, completeLesson, scale, correct, errors, doubled, isDiagnostic, isMistakes, isCheckpoint]);

  const perfect = errors === 0;
  const accuracy = correct + errors > 0 ? Math.round((correct / (correct + errors)) * 100) : 0;
  const level = useStore((s) => s.level);

  const isQuiz = false;
  // наступна одиниця тієї ж гілки (completed уже містить щойно пройдений урок)
  const completedNow = useStore((s) => s.completed);
  const prog = useStore((s) => (ref ? s.branchProg[ref.branch.code] : undefined));
  const nextId = ref ? nextUnit(ref.branch.code, completedNow, prog, readyLessonIds(ref.branch), !!ref.branch.final?.ready) : null;
  const next = nextId ? unitById(nextId)?.unit : undefined;

  const failedCheckpoint = isCheckpoint && !passed;
  const retrySave = () => {
    setSaveState('saving');
    retryLocalWrite().then(
      () => setSaveState('ok'),
      () => setSaveState('error')
    );
  };
  // Точність нижче 60%: головна дія — повторити помилки, наступний урок другорядний
  const lowAccuracy = !isDiagnostic && !failedCheckpoint && correct + errors > 0 && accuracy < 60;
  const goMistakes = () => router.replace(`/lesson/${id}`);
  const goNext = () => (next ? router.replace(`/lesson/${next.id}`) : router.dismissTo(hub));

  const talkKind: PhraseKind = failedCheckpoint
    ? 'crownFail'
    : isCheckpoint
    ? 'crownPass'
    : leveledUp
    ? 'levelUp'
    : isPractice
    ? 'lessonPractice'
    : isQuiz
    ? 'quizDone'
    : perfect
    ? 'lessonPerfect'
    : 'lessonDone';
  const talk = useMemo(() => say(talkKind), [talkKind]);

  const h1 = failedCheckpoint
    ? 'Скриню золота не відкрито'
    : isCheckpoint
    ? '💰 Скриня золота твоя!'
    : perfect
    ? 'Ідеально!'
    : isPractice
    ? 'Повторення залічено'
    : isQuiz
    ? 'Квіз пройдено'
    : 'Урок пройдено';

  const sub = failedCheckpoint
    ? `Потрібно 80%, у тебе ${accuracy}%. Буває. Повтори уроки і повертайся.`
    : isCheckpoint
    ? 'Модуль закрито, скриня золота відкрита. Це фундамент — далі цікавіше.'
    : perfect
    ? 'Жодної помилки. Ростеш, красава.'
    : lowAccuracy
    ? `Точність ${accuracy}%. Краще одразу розібрати помилки, поки свіжо.`
    : isPractice
    ? 'Повторення без нагороди: це вже зараховано раніше. Пам’ять дякує.'
    : 'Норм. Помилки — частина процесу.';


  if (saveState !== 'ok') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14, backgroundColor: C.bg, paddingTop: insets.top }}>
        <Text style={styles.h1}>{saveState === 'saving' ? 'Зберігаю результат…' : 'Не вдалося зберегти результат'}</Text>
        {saveState === 'error' && (
          <>
            <Text style={styles.muted}>Урок пройдено, але пристрій не записав результат. Перевір вільне місце й натисни «Повторити».</Text>
            <Button title="Повторити" onPress={retrySave} />
          </>
        )}
      </View>
    );
  }
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 20 }]}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 8 }} showsVerticalScrollIndicator={false}>
      <View style={styles.center}>
        <View style={{ width: '100%', marginBottom: 6 }}>
          <GrindykSay text={talk.text} pose={talk.pose} height={120} />
        </View>
        <Pop>
          <Text style={styles.h1}>{h1}</Text>
        </Pop>
        <Text style={styles.muted}>{sub}</Text>

        {leveledUp && (
          <Animated.View style={[styles.levelUp, { transform: [{ scale }] }]}>
            <Text style={{ fontSize: 34 }}>🚀</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.levelUpTitle}>LEVEL UP! Тепер Lvl {level}</Text>
              <Text style={styles.achSub}>Гріндік прокачався. Так тримати.</Text>
            </View>
          </Animated.View>
        )}

        {perfect && !failedCheckpoint && !isPractice && (
          <Pop delay={120} style={{ alignSelf: 'stretch' }}>
          <View style={styles.ach}>
            <Text style={{ fontSize: 36 }}>🎯</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.achTitle}>Бездоганний урок!</Text>
              <Text style={styles.achSub}>Жодної помилки: комбо-бонус на максимум.</Text>
            </View>
          </View>
          </Pop>
        )}

        {newAch.map((aid) => {
          const a = ACHIEVEMENTS.find((x) => x.id === aid);
          return a ? (
            <Pop key={aid} delay={220} style={{ alignSelf: 'stretch' }}>
            <View style={styles.ach}>
              <Text style={{ fontSize: 34 }}>{a.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.achTitle}>Досягнення: {a.title}</Text>
                <Text style={styles.achSub}>{a.desc}</Text>
              </View>
            </View>
            </Pop>
          ) : null;
        })}

        {newAch.map((aid) => {
          const meme = MEMES.find((m) => m.unlockedBy === aid);
          return meme ? (
            <View key={`meme-${aid}`} style={{ width: 200, marginTop: 10 }}>
              <Text style={styles.memeTag}>НОВИЙ МЕМ У КОЛЕКЦІЇ</Text>
              <MemeCard meme={meme} />
            </View>
          ) : null;
        })}

        {doubled && <Text style={styles.doubled}>✨ Подвійні коїни спрацювали</Text>}

        {!failedCheckpoint && (
          <View style={styles.rewardRow}>
            <View style={styles.rewardItem}>
              <Icon name="coin" size={34} />
              <Text style={styles.reward}>+{coins}</Text>
            </View>
            <View style={styles.rewardItem}>
              <Icon name="xp" size={34} />
              <Text style={[styles.reward, { color: C.blueTxt }]}>+{xp} XP</Text>
            </View>
          </View>
        )}
      </View>

      <View style={{ width: '100%' }}>
        <Row label="Вірних відповідей" value={`${correct}`} color={C.accentTxt} />
        <Row label="Помилок" value={`${errors}`} color={errors ? C.red : C.accent} />
        <Row label="Точність" value={`${accuracy}%`} color={C.txt} />
        <Row label="Макс. комбо-бонус" value={`+${maxBonus}%`} color={C.fireTxt} />
        {isQuiz && <Row label="Бонус за швидкість" value={`+${speed} 🪙`} color={C.blueTxt} />}
      </View>

      <View style={styles.nextBox}>
        <Text style={styles.nextTxt}>
          {failedCheckpoint
            ? 'Повтори будь-який урок (🔁 practice) і спробуй знову.'
            : next
            ? `Далі: ${next.title}`
            : 'Повертайся до гілки: там видно, що відкрилось.'}
        </Text>
      </View>

      {ref && ref.unit.kb.length > 0 && (
        <View style={styles.nextBox}>
          <Text style={styles.memeTag}>МАТЕРІАЛИ В «БАЗІ»</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {ref.unit.kb.map((k) => (
              <Pressable key={k} onPress={() => router.push({ pathname: '/kb/[id]', params: { id: k } })} style={styles.kbChip} accessibilityRole="link">
                <Text style={styles.kbChipTxt}>📘 {kbGet(k, 'uk')?.title ?? k}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      </ScrollView>

      {lowAccuracy ? (
        <View style={{ gap: 10 }}>
          <Button title="Пройти ще раз (без нагороди)" onPress={goMistakes} />
          <Button title={next ? 'Далі' : 'До гілки'} ghost onPress={goNext} />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Button
            title={next ? 'Далі' : 'До гілки'}
            onPress={() => {
              if (coins > 0) playSfx('coin');
              goNext();
            }}
          />
          {/* етап E: карта Києва показує, що пройдено й що відкрилось */}
          {ref && ref.branch.code !== 'STA-A1' && passed && <Button title="🗺 Карта: що відкрилось" ghost onPress={() => router.replace({ pathname: '/map/[code]', params: { code: ref.branch.code, done: id } })} />}
          {next && !ref && <Button title="До гілки" ghost onPress={() => router.dismissTo(hub)} />}
        </View>
      )}
      <Watermark />
    </View>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color }]}>{value}</Text>
    </View>
  );
}

const makeStyles = (C: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 22, justifyContent: 'space-between' },
  center: { alignItems: 'center' },
  emoji: { fontSize: 60 },
  h1: { color: C.txt, fontSize: 26, fontWeight: '800', marginTop: 8 },
  memeTag: { color: C.goldTxt, fontWeight: '900', fontSize: 11, letterSpacing: 1, textAlign: 'center', marginBottom: 6 },
  kbChip: { backgroundColor: C.panel2, borderRadius: 10, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, paddingVertical: 6, paddingHorizontal: 10 },
  kbChipTxt: { color: C.blueTxt, fontWeight: '800', fontSize: 13 },
  doubled: { color: C.goldTxt, fontWeight: '800', marginTop: 10 },
  diagTxt: { color: C.txt, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  muted: { color: C.muted, fontSize: 14, marginTop: 6, textAlign: 'center' },
  levelUp: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    backgroundColor: C.blueTint,
    borderColor: C.blue,
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    width: '100%',
    borderBottomWidth: 5,
    borderBottomColor: C.blueEdge,
  },
  levelUpTitle: { color: C.blueTxt, fontWeight: '800', fontSize: 15 },
  ach: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    backgroundColor: C.panel,
    borderColor: C.gold,
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    width: '100%',
    borderBottomWidth: 5,
    borderBottomColor: C.goldEdge,
  },
  achTitle: { color: C.txt, fontWeight: '800', fontSize: 15 },
  achSub: { color: C.muted, fontSize: 13, marginTop: 2 },
  rewardRow: { flexDirection: 'row', gap: 22, marginVertical: 16 },
  rewardItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reward: { color: C.goldTxt, fontSize: 26, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 13,
    borderBottomColor: C.line,
    borderBottomWidth: 1,
  },
  rowLabel: { color: C.txt, fontSize: 15 },
  rowValue: { fontSize: 15, fontWeight: '800' },
  nextBox: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
    marginVertical: 14,
    borderBottomWidth: 5,
  },
  nextTxt: { color: C.txt, fontSize: 15, textAlign: 'center' },
});
