import React, { useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LESSONS, QUIZZES, MODULE_TITLE } from '../src/data/lessons';
import { GOAL_XP, GOAL_LABEL, MAX_STREAK_FREEZES, STREAK_FREEZE_COST, useStore } from '../src/store';
import { C } from '../src/theme';
import { Icon, IconName } from '../src/components/Icon';

// Пози Гріндіка (вирізані з 3D-рендера); ширина/висота нарізаних файлів
const POSES = {
  stand: require('../assets/character/pose-stand.png'),
  think: require('../assets/character/pose-think.png'),
  cheer: require('../assets/character/pose-cheer.png'),
} as const;
const POSE_RATIO = { stand: 0.374, think: 0.405, cheer: 0.549 } as const;
type PoseName = keyof typeof POSES;

const LEVEL_TITLES = [
  'Щойно дізнався що є арбітраж',
  'Вже читав про це в телеграмі',
  'Злив перший бюджет на навчання',
];

const MODULE_LESSONS = LESSONS.filter((l) => l.kind !== 'checkpoint');
const CHECKPOINT = LESSONS.find((l) => l.kind === 'checkpoint');
const PATH_ITEMS = CHECKPOINT ? [...MODULE_LESSONS, CHECKPOINT] : MODULE_LESSONS;
const LAST = PATH_ITEMS.length - 1;

// Геометрія шляху: вузли лежать на плавній синусоїді (змійка зверху вниз)
const NODE = 74;
const QUIZ_NODE = 84;
const STEP = 118;
const TOP = 30;
const PHASE = 0.95; // радіан на вузол: вигин приблизно кожні 3.3 вузла
const POSE_H = 150;

// Вигини змійки: тут у "кишені" з протилежного боку стоять квіз і Гріндік
const BENDS: { t: number; pocketSide: -1 | 1 }[] = [];
for (let k = 0; ; k++) {
  const t = (Math.PI / 2 + k * Math.PI) / PHASE;
  if (t > LAST + 0.4) break;
  BENDS.push({ t, pocketSide: k % 2 === 0 ? -1 : 1 });
}

// Кожен квіз стає в найближчий до своїх уроків вигин
const QUIZ_SLOTS = (() => {
  const used = new Set<number>();
  const slots: { quiz: (typeof QUIZZES)[number]; bend: (typeof BENDS)[number] }[] = [];
  QUIZZES.forEach((quiz) => {
    const target = Math.max(...(quiz.requires ?? []).map((id) => PATH_ITEMS.findIndex((l) => l.id === id)));
    let best = -1;
    let bestD = Infinity;
    BENDS.forEach((b, k) => {
      const d = Math.abs(b.t - target);
      if (!used.has(k) && d < bestD) {
        bestD = d;
        best = k;
      }
    });
    if (best >= 0) {
      used.add(best);
      slots.push({ quiz, bend: BENDS[best] });
    }
  });
  return slots;
})();

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: winW } = useWindowDimensions();
  const {
    playerName,
    playerPhoto,
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
    setPlayerName,
    setPlayerPhoto,
  } = useStore();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const lvlTitle = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  const nextIndex = MODULE_LESSONS.findIndex((l) => !completed.includes(l.id));
  const moduleDone = nextIndex === -1;
  const checkpointDone = CHECKPOINT ? completed.includes(CHECKPOINT.id) : false;
  const currentIdx = moduleDone ? LAST : nextIndex;

  const goalTarget = GOAL_XP[dailyGoal];
  const goalPct = Math.min(1, xpToday / goalTarget);
  const canBuyFreeze = coins >= STREAK_FREEZE_COST && streakFreezes < MAX_STREAK_FREEZES;

  const shownName = playerName || 'Гравець';
  const initial = shownName.trim().charAt(0).toUpperCase();

  // геометрія під поточну ширину екрана
  const W = Math.min(winW, 480) - 44;
  const cx = W / 2;
  const A = Math.min(96, (W - NODE) / 2 - 8);
  const xAt = (t: number) => cx + A * Math.sin(t * PHASE);
  const yAt = (t: number) => TOP + NODE / 2 + t * STEP;
  const H = yAt(LAST) + NODE / 2 + 70;

  const pathD = (toT: number) => {
    let d = '';
    for (let t = 0; t <= toT + 1e-6; t += 0.05) {
      d += `${d ? 'L' : 'M'}${xAt(t).toFixed(1)} ${yAt(t).toFixed(1)} `;
    }
    return d;
  };

  // Фото з галереї стискаємо до 320 px і зберігаємо як data-uri: так воно переживає перезапуск і працює на вебі
  const pickPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const small = await ImageManipulator.manipulate(res.assets[0].uri).resize({ width: 320 }).renderAsync();
      const saved = await small.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      if (saved.base64) setPlayerPhoto(`data:image/jpeg;base64,${saved.base64}`);
    } catch (e) {
      console.warn('Не вдалося вибрати фото', e);
    }
  };

  const saveName = () => {
    if (draft.trim()) setPlayerName(draft);
    setEditing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.topbar, { paddingTop: insets.top + 10 }]}>
        <Text style={styles.course}>FB АРБІТРАЖ</Text>
        <Stat color={C.fire} icon="streak" value={streak} />
        <Stat color={C.blue} icon="xp" value={xp} />
        <Stat color={C.gold} icon="coin" value={coins} />
        <Stat color={C.accent} icon="energy" value={energy} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: insets.bottom + 30 }}>
        <View style={styles.hero}>
          <Pressable onPress={pickPhoto}>
            <View style={styles.avatar}>
              {playerPhoto ? (
                <Image source={{ uri: playerPhoto }} style={styles.avatarImg} />
              ) : (
                <Text style={styles.avatarInitial}>{initial}</Text>
              )}
            </View>
            <View style={styles.avatarBadge}>
              <Text style={styles.avatarBadgeTxt}>{playerPhoto ? '✎' : '+'}</Text>
            </View>
          </Pressable>
          {editing ? (
            <TextInput
              style={styles.nameInput}
              value={draft}
              onChangeText={setDraft}
              autoFocus
              maxLength={14}
              onSubmitEditing={saveName}
              onBlur={saveName}
              placeholder="Твій нік"
              placeholderTextColor={C.muted}
            />
          ) : (
            <Pressable
              onPress={() => {
                setDraft(playerName);
                setEditing(true);
              }}
            >
              <Text style={styles.name}>
                {shownName} <Text style={styles.nameEdit}>✎</Text>
              </Text>
            </Pressable>
          )}
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
            <View style={styles.buyRow}>
              <Text style={[styles.freezeBuy, !canBuyFreeze && styles.freezeBuyOff]}>
                Купити за {STREAK_FREEZE_COST}
              </Text>
              <Icon name="coin" size={16} />
            </View>
          )}
        </Pressable>

        <Text style={styles.modtag}>{MODULE_TITLE}</Text>

        <View style={{ width: W, height: H, alignSelf: 'center' }}>
          {/* течія: русло + пройдена частина */}
          <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
            <Path d={pathD(LAST)} stroke="#151a23" strokeWidth={28} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Path d={pathD(LAST)} stroke="#222a37" strokeWidth={4} strokeDasharray="2 12" strokeLinecap="round" fill="none" />
            {currentIdx > 0 && (
              <Path d={pathD(currentIdx)} stroke={C.accent} strokeOpacity={0.9} strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            )}
          </Svg>

          {/* кишені між вигинами: квіз + Гріндік у різних позах */}
          {QUIZ_SLOTS.map(({ quiz, bend }) => {
            const unlocked = (quiz.requires ?? []).every((id) => completed.includes(id));
            const done = completed.includes(quiz.id);
            const pose: PoseName = done ? 'cheer' : unlocked ? 'stand' : 'think';
            const gw = POSE_H * POSE_RATIO[pose];
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
                  source={POSES[pose]}
                  style={{ position: 'absolute', left: gx, top: yc + 62 - POSE_H, width: gw, height: POSE_H }}
                  resizeMode="contain"
                />
                <Pressable
                  disabled={!unlocked}
                  onPress={() => router.push(`/lesson/${quiz.id}`)}
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
          {PATH_ITEMS.map((l, i) => {
            const isCrown = l.kind === 'checkpoint';
            const done = completed.includes(l.id);
            const current = isCrown ? moduleDone && !checkpointDone : i === nextIndex;
            const locked = isCrown ? !moduleDone : !done && !current;
            const x = xAt(i);
            const y = yAt(i);
            return (
              <React.Fragment key={l.id}>
                <Pressable
                  disabled={locked}
                  onPress={() => router.push(`/lesson/${l.id}`)}
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
                    {isCrown ? (moduleDone ? '👑' : '🔒') : done ? '✓' : current ? '▶' : '🔒'}
                  </Text>
                </Pressable>
                <Text style={[styles.code, { left: x - 30, top: y + NODE / 2 + 4 }]}>{isCrown ? 'КОРОНА' : l.code}</Text>
                {current && (
                  <Text
                    style={[
                      styles.chip,
                      { left: Math.max(0, Math.min(W - 150, x - 75)), top: y + NODE / 2 + 22 },
                    ]}
                    numberOfLines={2}
                  >
                    {l.title}
                  </Text>
                )}
              </React.Fragment>
            );
          })}
        </View>

        {checkpointDone && (
          <View style={styles.doneBox}>
            <Text style={styles.doneTxt}>👑 Корона Модуля 01 твоя. Красава.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ icon, value, color }: { icon: IconName; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Icon name={icon} size={22} />
      <Text style={{ color, fontWeight: '800', fontSize: 15 }}>{value}</Text>
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
    marginBottom: 6,
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
  code: { position: 'absolute', width: 60, textAlign: 'center', color: C.muted, fontSize: 11, fontWeight: '800' },
  chip: {
    position: 'absolute',
    width: 150,
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
