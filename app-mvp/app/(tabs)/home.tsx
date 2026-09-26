import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Image,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Lesson } from '../../src/data/lessons';
import { MODULES, PATH } from '../../src/data/modules';
import { GOAL_XP, GOAL_LABEL, ENERGY_PER_LESSON, useStore } from '../../src/store';
import { C } from '../../src/theme';
import { TopBar } from '../../src/components/TopBar';
import { Quests } from '../../src/components/Quests';
import { GrindykSay } from '../../src/components/GrindykSay';
import { pose as poseFile, PoseName } from '../../src/data/poses';
import { homeSay, say } from '../../src/data/phrases';


const LAST = PATH.length - 1;

// Геометрія шляху: вузли лежать на плавній синусоїді (змійка зверху вниз)
const NODE = 74;
const QUIZ_NODE = 84;
const STEP = 118;
const TOP = 64; // місце під заголовок першого модуля
const GAP = 84; // додатковий простір на переході між модулями, туди стає заголовок
const PHASE = 0.95; // радіан на вузол: вигин приблизно кожні 3.3 вузла
const POSE_H = 150;

// Індекси на шляху, з яких починається кожен модуль
const MODULE_START = MODULES.map((_, mi) => PATH.findIndex((p) => p.moduleIndex === mi));
const BREAKS = MODULE_START.slice(1);

// Проміжок між останнім вузлом модуля і першим вузлом наступного плавно розтягується на GAP
const stretch = (t: number) => {
  let extra = 0;
  for (const b of BREAKS) {
    if (t >= b) extra += GAP;
    else if (t > b - 1) extra += GAP * (t - (b - 1));
  }
  return extra;
};
const yAt = (t: number) => TOP + NODE / 2 + t * STEP + stretch(t);

// Вигини змійки: тут у "кишені" з протилежного боку стоять квіз і Гріндік
type Bend = { t: number; pocketSide: -1 | 1 };
const BENDS: Bend[] = [];
for (let k = 0; ; k++) {
  const t = (Math.PI / 2 + k * Math.PI) / PHASE;
  if (t > LAST + 0.4) break;
  BENDS.push({ t, pocketSide: k % 2 === 0 ? -1 : 1 });
}

// Кожен квіз стає в найближчий до своїх уроків вільний вигин
const QUIZ_SLOTS = (() => {
  const used = new Set<number>();
  const slots: { quiz: Lesson; bend: Bend }[] = [];
  MODULES.forEach((m) =>
    m.quizzes.forEach((quiz) => {
      const target = Math.max(...(quiz.requires ?? []).map((id) => PATH.findIndex((p) => p.lesson.id === id)));
      let best = -1;
      let bestD = Infinity;
      // спершу шукаємо вигини, що не збігаються із заголовками модулів; якщо таких нема, беремо будь-який вільний
      for (const avoidChips of [true, false]) {
        BENDS.forEach((b, k) => {
          if (avoidChips && BREAKS.some((br) => Math.abs(b.t - (br - 0.5)) < 1.0)) return;
          const d = Math.abs(b.t - target);
          if (!used.has(k) && d < bestD) {
            bestD = d;
            best = k;
          }
        });
        if (best >= 0) break;
      }
      if (best >= 0) {
        used.add(best);
        slots.push({ quiz, bend: BENDS[best] });
      }
    })
  );
  return slots;
})();

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const { energy, xpToday, dailyGoal, completed, daysAway, strictEnergy, refreshEnergy } = useStore();

  useFocusEffect(
    React.useCallback(() => {
      refreshEnergy();
    }, [refreshEnergy])
  );

  // Жорстка енергія: без 10 одиниць нові уроки закриті, повтор пройденого доступний
  const open = (id: string) => {
    if (strictEnergy && energy < ENERGY_PER_LESSON && !completed.includes(id)) {
      setTalk(say('lowEnergy'));
      router.navigate('/shop');
      return;
    }
    router.push(`/lesson/${id}`);
  };

  const scrollRef = useRef<ScrollView>(null);
  const [pathTop, setPathTop] = useState<number | null>(null);
  const scrolled = useRef(false);

  const firstOpen = PATH.findIndex((p) => !completed.includes(p.lesson.id));
  const allDone = firstOpen === -1;
  const currentIdx = allDone ? LAST : firstOpen;

  const goalTarget = GOAL_XP[dailyGoal];
  const [talk, setTalk] = useState(() =>
    homeSay({ daysAway, energy, goalDone: xpToday >= GOAL_XP[dailyGoal], fresh: true })
  );
  const goalPct = Math.min(1, xpToday / goalTarget);

  // геометрія під поточну ширину екрана
  const W = Math.min(winW, 480) - 44;
  const cx = W / 2;
  const A = Math.min(96, (W - NODE) / 2 - 8);
  const xAt = (t: number) => cx + A * Math.sin(t * PHASE);
  const H = yAt(LAST) + NODE / 2 + 70;

  // Шлях довгий: одразу прокручуємо до поточного уроку
  useEffect(() => {
    if (pathTop === null || scrolled.current) return;
    scrolled.current = true;
    scrollRef.current?.scrollTo({ y: Math.max(0, pathTop + yAt(currentIdx) - 260), animated: false });
  }, [pathTop, currentIdx]);

  const pathD = (toT: number) => {
    let d = '';
    for (let t = 0; t <= toT + 1e-6; t += 0.05) {
      d += `${d ? 'L' : 'M'}${xAt(t).toFixed(1)} ${yAt(t).toFixed(1)} `;
    }
    return d;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar />

      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 30 }}>
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

        <Quests />

        <View style={{ marginTop: 16, marginBottom: 6 }}>
          <GrindykSay
            text={talk.text}
            pose={talk.pose}
            height={120}
            onPress={() =>
              setTalk(homeSay({ daysAway: 0, energy, goalDone: xpToday >= goalTarget, fresh: false }))
            }
          />
        </View>

        <View style={{ width: W, height: H, alignSelf: 'center' }} onLayout={(e) => setPathTop(e.nativeEvent.layout.y)}>
          {/* течія: русло + пройдена частина */}
          <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
            <Path d={pathD(LAST)} stroke="#151a23" strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Path d={pathD(LAST)} stroke="#222a37" strokeWidth={4} strokeDasharray="2 12" strokeLinecap="round" fill="none" />
            {currentIdx > 0 && (
              <Path d={pathD(currentIdx)} stroke={C.accent} strokeOpacity={0.9} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            )}
          </Svg>

          {/* заголовки модулів: перший угорі, решта на розтягнутих переходах між модулями */}
          {MODULES.map((m, mi) => {
            const yc = mi === 0 ? TOP / 2 : yAt(MODULE_START[mi] - 0.5);
            const lockedMod = !allDone && firstOpen < MODULE_START[mi];
            return (
              <View key={m.id} style={[styles.modHead, { top: yc - 20, width: W }, lockedMod && { opacity: 0.55 }]}>
                <Text style={[styles.modChip, { maxWidth: W - 8 }]}>{m.title}</Text>
              </View>
            );
          })}

          {/* кишені між вигинами: квіз + Гріндік у різних позах */}
          {QUIZ_SLOTS.map(({ quiz, bend }) => {
            const unlocked = (quiz.requires ?? []).every((id) => completed.includes(id));
            const done = completed.includes(quiz.id);
            const pose: PoseName = done ? 'cheer' : unlocked ? 'stand' : 'think';
            const gw = POSE_H * poseFile(pose).ratio;
            const yc = yAt(bend.t);
            const pathX = xAt(bend.t);
            const left = bend.pocketSide < 0 ? 4 : pathX + NODE / 2 + 20;
            const right = bend.pocketSide < 0 ? pathX - NODE / 2 - 20 : W - 4;
            const qx = bend.pocketSide < 0 ? right - QUIZ_NODE : left;
            const gx = bend.pocketSide < 0 ? left : right - gw;
            const qTop = yc - 12 - QUIZ_NODE / 2;
            return (
              <React.Fragment key={quiz.id}>
                <Image
                  source={poseFile(pose).src}
                  style={{ position: 'absolute', left: gx, top: yc + 62 - POSE_H, width: gw, height: POSE_H }}
                  resizeMode="contain"
                />
                <Pressable
                  disabled={!unlocked}
                  onPress={() => open(quiz.id)}
                  style={({ pressed }) => [
                    styles.quiz,
                    { left: qx, top: qTop },
                    done && styles.nodeDone,
                    unlocked && !done && styles.quizOpen,
                    !unlocked && styles.nodeLock,
                    pressed && unlocked && styles.nodePressed,
                  ]}
                >
                  <Text style={[styles.quizTxt, unlocked && styles.nodeTxtOn]}>
                    {done ? '✓' : unlocked ? '?' : '🔒'}
                  </Text>
                </Pressable>
                <Text style={[styles.quizLabel, { left: qx + QUIZ_NODE / 2 - 55, top: qTop + QUIZ_NODE + 4 }]} numberOfLines={2}>
                  {quiz.title}
                  {'\n'}⏱ на час · бонус
                </Text>
              </React.Fragment>
            );
          })}

          {/* вузли уроків на течії */}
          {PATH.map(({ lesson: l, isCrown }, i) => {
            const done = completed.includes(l.id);
            const current = !allDone && i === firstOpen;
            const locked = !done && !current;
            const x = xAt(i);
            const y = yAt(i);
            return (
              <React.Fragment key={l.id}>
                <Pressable
                  disabled={locked}
                  onPress={() => open(l.id)}
                  style={({ pressed }) => [
                    styles.node,
                    { left: x - NODE / 2, top: y - NODE / 2 },
                    isCrown ? styles.nodeCrown : done && styles.nodeDone,
                    !isCrown && current && styles.nodeCur,
                    locked && styles.nodeLock,
                    pressed && !locked && styles.nodePressed,
                  ]}
                >
                  <Text style={[styles.nodeTxt, !isCrown && (done || current) && styles.nodeTxtOn]}>
                    {isCrown ? (locked ? '🔒' : '👑') : done ? '✓' : current ? '▶' : '🔒'}
                  </Text>
                </Pressable>
                <View style={[styles.codeWrap, { left: x - 40, top: y + NODE / 2 + 3 }]}>
                  <Text style={styles.code}>{isCrown ? 'КОРОНА' : l.code}</Text>
                </View>
                {current && (
                  <Text
                    style={[
                      styles.chip,
                      { width: Math.min(W - 16, 300), left: Math.max(0, Math.min(W - Math.min(W - 16, 300), x - Math.min(W - 16, 300) / 2)), top: y + NODE / 2 + 21 },
                    ]}
                    numberOfLines={1}
                  >
                    {l.title}
                  </Text>
                )}
              </React.Fragment>
            );
          })}
        </View>

        {allDone && (
          <View style={styles.doneBox}>
            <Text style={styles.doneTxt}>🏁 Усі доступні модулі пройдено. Нові — скоро. Красава.</Text>
          </View>
        )}
      </ScrollView>
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: C.panel,
    borderRadius: 12,
    paddingVertical: 5,
    paddingHorizontal: 9,
    borderBottomWidth: 3,
    borderBottomColor: '#0a0c10',
  },
  hero: { alignItems: 'center', marginVertical: 14 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.panel2,
    borderWidth: 3,
    borderColor: C.accent,
    borderBottomWidth: 6,
    borderBottomColor: C.accentEdge,
  },
  avatarImg: { width: '100%', height: '100%' },
  avatarInitial: { color: C.accent, fontSize: 42, fontWeight: '900' },
  avatarBadge: {
    position: 'absolute',
    right: -2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderBottomWidth: 4,
    borderBottomColor: C.accentEdge,
  },
  avatarBadgeTxt: { color: '#05140a', fontSize: 18, fontWeight: '900', marginTop: -2 },
  name: { color: C.txt, fontWeight: '800', fontSize: 18, marginTop: 8 },
  nameEdit: { color: C.muted, fontSize: 13, fontWeight: '600' },
  nameInput: {
    color: C.txt,
    fontWeight: '800',
    fontSize: 18,
    marginTop: 8,
    minWidth: 140,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: C.accent,
    paddingVertical: 2,
  },
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
  buyRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  freezeBuy: { color: C.accent, fontSize: 12, fontWeight: '800' },
  freezeBuyOff: { color: C.muted },
  modHead: { position: 'absolute', left: 0, alignItems: 'center' },
  modChip: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
    backgroundColor: '#0f2419',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    overflow: 'hidden',
  },
  node: {
    position: 'absolute',
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
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
  codeWrap: { position: 'absolute', width: 80, alignItems: 'center' },
  code: {
    color: C.muted,
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: C.bg,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  chip: {
    position: 'absolute',
    textAlign: 'center',
    color: C.txt,
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: C.panel,
    borderRadius: 10,
    overflow: 'hidden',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  quiz: {
    position: 'absolute',
    width: QUIZ_NODE,
    height: QUIZ_NODE,
    borderRadius: QUIZ_NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.panel,
    borderBottomWidth: 8,
    borderBottomColor: '#0a0c10',
  },
  quizOpen: { backgroundColor: C.blue, borderBottomColor: C.blueEdge },
  quizTxt: { fontSize: 34, fontWeight: '900', color: C.txt },
  quizLabel: { position: 'absolute', width: 110, textAlign: 'center', color: C.muted, fontSize: 11, fontWeight: '700' },
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
