// ВИД-СЦЕНА: гравець УСЕРЕДИНІ поточної зупинки Києва (ТЗ A3/B1–B7).
//  1) повноекранне painterly-середовище (cover) + віньєтка; плита рухається паралаксом (гіро/миша);
//  2) Гріндік-cutout у повний зріст СТОЇТЬ НА ПІДЛОЗІ: ступні в точці `feet` локації, зріст за глибиною, контактна тінь-еліпс під ногами,
//     дзеркалиться до цілі; квіз-NPC стоїть на тій самій підлозі;
//  3) РІВНО ОДИН зелений objective-glow + пульсуючий пін на цілі (одна ціль = один круг), скриня золота = справжня скриня на цілі;
//  4) заголовок за Додатком А (<LessonTitle>), світла тепла картка завдання, HUD-пігулки.
// Усе, що торкається гравець, живе в координатах сцени. Картка займає нижню смугу, а сцена вписується над нею, щоб ступні не ховались.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BoostBanner } from '../components/BoostBanner';
import { Button } from '../components/Button';
import { PoseImage } from '../components/PoseImage';
import { Quests } from '../components/Quests';
import { pose, type PoseName } from '../data/poses';
import { ScrollView } from 'react-native';
import { art, artName, figureShadow, type ArtKey } from './index';
import { Hud, hudPill } from './Hud';
import { LOCS, standFor } from './levels';
import { LessonTitle } from './LessonTitle';
import { ObjectiveGlow } from './ObjectiveGlow';
import type { JStop } from './stops';
import { requestTilt, useTilt } from './tilt';
import { WeatherOverlay, useSceneState } from './WeatherOverlay';

const NPCS: ArtKey[] = ['cutout/npc/barista', 'cutout/npc/colleague', 'cutout/npc/rival', 'cutout/npc/teamlead'];

export type SceneQuiz = { id: string; title: string; unlocked: boolean; done: boolean };

export type StopSceneProps = {
  stop: JStop;
  allDone: boolean;
  quizzes: SceneQuiz[];
  talk: { text: string; pose: PoseName };
  onTalk: () => void;
  onStart: (lessonId: string) => void;
  onQuiz: (id: string) => void;
  onMap: () => void;
  goal: { xp: number; target: number; label: string };
  claimable: number;
  dueCount: number;
  offerAdapt: boolean;
  onDismissAdapt: () => void;
  completedCount: number;
};

export function StopScene(p: StopSceneProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const weather = useSceneState();
  const tilt = useTilt(true);
  const [area, setArea] = useState({ w: 390, h: 700 });
  const [cardH, setCardH] = useState(178);
  const [questsOpen, setQuestsOpen] = useState(false);
  const [bubble, setBubble] = useState(true);

  const { stop } = p;
  // dev-перегляд локації: ?loc=<id> (лише в dev-збірці), щоб швидко звіряти підлогу й ціль
  const dbgLoc = __DEV__ && Platform.OS === 'web' && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('loc') : null;
  const loc = (dbgLoc && LOCS[dbgLoc]) || stop.loc;
  const dbgAlt = __DEV__ && Platform.OS === 'web' && typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('alt') : null;
  const stand = standFor(dbgLoc && LOCS[dbgLoc] ? dbgLoc : stop.locId, stop.moduleNo, stop.k, dbgAlt != null ? Number(dbgAlt) : null);
  const gp = pose(stand.pose);
  const plate = art(loc.plate);
  

  // Короткий «привіт» від Гріндіка при кожному приїзді, далі лише по тапу
  useEffect(() => {
    setBubble(true);
    const t = setTimeout(() => setBubble(false), 5200);
    return () => clearTimeout(t);
  }, [stop.index]);

  // ───────── геометрія сцени: вписуємо плиту над карткою ─────────
  const SH = Math.max(280, area.h - cardH + 34); // висота сцени (картка трохи заходить на нижній край плити)
  let plateH = SH * 1.1;
  let plateW = plateH * plate.ratio;
  if (plateW < area.w + 40) {
    plateW = area.w + 40;
    plateH = plateW / plate.ratio;
  }
  const top = -(plateH - SH) / 2;
  const left = Math.min(-16, Math.max(area.w - plateW + 16, area.w / 2 - stand.cam * plateW));
  const fx = stand.feet.x * plateW;
  const fy = top + stand.feet.y * plateH;
  const gh = stand.h * plateH;
  const gw = gh * gp.ratio;
  const gx = loc.goal.x * plateW;
  const gy = top + loc.goal.y * plateH;
  const facing = loc.goal.x >= stand.feet.x ? 1 : -1;

  // ───────── зум у ціль перед відкриттям уроку ─────────
  const zoom = useRef(new Animated.Value(0)).current;
  const [origin, setOrigin] = useState('50% 50%');
  useEffect(() => {
    zoom.setValue(0);
  }, [stop.index, zoom]);
  const enter = async (id: string) => {
    await requestTilt(); // iOS просить дозвіл на гіроскоп саме від жесту
    setOrigin(`${Math.round(left + gx)}px ${Math.round(gy)}px`);
    Animated.timing(zoom, { toValue: 1, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(() => {
      p.onStart(id);
      setTimeout(() => zoom.setValue(0), 400);
    });
  };

  const pending = p.quizzes.find((q) => q.unlocked && !q.done);
  const npcKey = NPCS[(stop.moduleNo + stop.k) % NPCS.length];
  const npc = art(npcKey);
  const npcX = Math.min(0.9, Math.max(0.1, stand.feet.x + (facing > 0 ? -0.14 : 0.14))) * plateW;
  const npcH = gh * 0.97;

  const goalPct = Math.min(1, p.goal.xp / Math.max(1, p.goal.target));
  const kicker = stop.isChest ? `МОДУЛЬ ${String(stop.moduleNo).padStart(2, '0')} · СКРИНЯ ЗОЛОТА` : `МОДУЛЬ ${String(stop.moduleNo).padStart(2, '0')} · УРОК ${stop.lesson.code}`;
  const chestKey: ArtKey = 'cutout/objects/chest_closed';
  const chest = art(chestKey);
  const chestH = Math.max(70, plateH * 0.17);

  const bubbleLeft = Math.max(8, Math.min(area.w - 222, left + fx - 111));
  const bubbleTop = Math.max(insets.top + 190, fy - gh - 64);
  const sceneShift = Animated.multiply(tilt.x, -12);

  return (
    <View style={styles.root} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={{ position: 'absolute', left: 0, top: 0, width: area.w, height: SH, overflow: 'hidden' }}>
        <Animated.View style={{ flex: 1, transformOrigin: origin as unknown as string, transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.5] }) }] } as object}>
          {/* середовище + усе, що стоїть у ньому (координати плити); рухається разом */}
          <Animated.View style={{ position: 'absolute', left, top: 0, width: plateW, height: SH, transform: [{ translateX: sceneShift }] }}>
            <Image source={plate.src} style={{ position: 'absolute', left: 0, top, width: plateW, height: plateH }} resizeMode="stretch" />

            {/* квіз-NPC на підлозі поруч */}
            {pending && !stop.isChest && (
              <Pressable onPress={() => p.onQuiz(pending.id)} style={{ position: 'absolute', left: npcX - (npcH * npc.ratio) / 2, top: fy - npcH * 0.985, width: npcH * npc.ratio, height: npcH }} accessibilityLabel={`Квіз на час: ${pending.title}`}>
                <ContactShadow w={npcH * npc.ratio * 0.9} y={npcH * 0.985} />
                <PoseImage p={{ src: npc.src, ratio: npc.ratio, key: npcKey }} width={npcH * npc.ratio} height={npcH} shadow={0.5} />
                <View style={styles.badge}>
                  <Text style={styles.badgeTxt}>⏱ квіз</Text>
                </View>
              </Pressable>
            )}

            {/* скриня золота стоїть на цілі, коли зупинка = кінець модуля */}
            {stop.isChest && (
              <View pointerEvents="none" style={{ position: 'absolute', left: gx - (chestH * chest.ratio) / 2, top: gy - chestH * 0.8, width: chestH * chest.ratio, height: chestH }}>
                <Image source={chest.src} style={[{ width: '100%', height: '100%' }, figureShadow(0.7)]} resizeMode="contain" />
              </View>
            )}

            {/* РІВНО ОДИН зелений objective-glow із пульсуючим піном */}
            <ObjectiveGlow x={gx} y={gy} radius={Math.max(64, plateW * 0.06)} intensity={1.6} />

            {/* Гріндік: ступні на підлозі, тінь під ногами */}
            <Pressable onPress={() => { setBubble(true); p.onTalk(); }} style={{ position: 'absolute', left: fx - gw / 2, top: fy - gh * 0.985, width: gw, height: gh }} accessibilityLabel="Гріндік">
              <ContactShadow w={gw * 0.85} y={gh * 0.985} />
              <View style={{ width: gw, height: gh, transform: [{ scaleX: facing }] }}>
                <PoseImage p={gp} width={gw} height={gh} shadow={0.8} />
              </View>
            </Pressable>
          </Animated.View>

          {/* віньєтка (зверху, знизу, краї): світлий арт читається, текст видно */}
          <Svg pointerEvents="none" width={area.w} height={SH} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="svig" cx="50%" cy="46%" r="75%">
                <Stop offset="0.5" stopColor="#05070a" stopOpacity={0} />
                <Stop offset="1" stopColor="#05070a" stopOpacity={0.5} />
              </RadialGradient>
              <LinearGradient id="svigT" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#05070a" stopOpacity={0.55} />
                <Stop offset="1" stopColor="#05070a" stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id="svigB" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0" stopColor="#05070a" stopOpacity={0.45} />
                <Stop offset="1" stopColor="#05070a" stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={area.w} height={SH} fill="url(#svig)" />
            <Rect x={0} y={0} width={area.w} height={SH * 0.26} fill="url(#svigT)" />
            <Rect x={0} y={SH * 0.78} width={area.w} height={SH * 0.22} fill="url(#svigB)" />
          </Svg>
        </Animated.View>
        <WeatherOverlay state={weather} />
      </View>

      {/* бульба Гріндіка: з'являється при приїзді й по тапу */}
      {bubble && (
        <Pressable onPress={() => setBubble(false)} style={[styles.bubble, { left: bubbleLeft, top: bubbleTop }]}>
          <Text style={styles.bubbleTxt} numberOfLines={3}>
            {p.talk.text}
          </Text>
        </Pressable>
      )}

      {/* HUD + перемикач на вид-карту */}
      <View pointerEvents="box-none" style={[styles.hud, { top: insets.top + 6 }]}>
        <Pressable onPress={p.onMap} style={[hudPill, styles.mapBtn]} accessibilityLabel="Відкрити карту Києва">
          <Text style={styles.mapIco}>🗺️</Text>
          <Text style={styles.mapTxt}>Карта</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Hud />
      </View>

      {/* заголовок за Додатком А */}
      <View pointerEvents="none" style={[styles.titleBox, { top: insets.top + 50 }]}>
        <Text style={styles.kicker}>{kicker}</Text>
        <View style={{ marginTop: 6 }}>
          <LessonTitle text={loc.title} plateName={artName(loc.plate)} maxWidth={Math.min(area.w - 70, 330)} />
        </View>
      </View>

      {/* швидкі входи: іконки в куті, не плашки */}
      <View style={[styles.side, { top: insets.top + 50 }]}>
        <Pressable onPress={() => setQuestsOpen((o) => !o)} style={[styles.sideBtn, p.claimable > 0 && { borderColor: '#36e27a' }]} accessibilityLabel="Завдання дня">
          <Text style={styles.sideIco}>🌟</Text>
          {p.claimable > 0 && <Text style={styles.sideBadge}>{p.claimable}</Text>}
        </Pressable>
        <Pressable onPress={() => router.push('/sim')} style={styles.sideBtn} accessibilityLabel="Симулятор кампанії">
          <Text style={styles.sideIco}>📊</Text>
        </Pressable>
        {p.completedCount >= 2 && (
          <Pressable onPress={() => router.push('/lesson/practice')} style={styles.sideBtn} accessibilityLabel="Швидке тренування">
            <Text style={styles.sideIco}>🏋️</Text>
            {p.dueCount > 0 && <Text style={styles.sideBadge}>{p.dueCount}</Text>}
          </Pressable>
        )}
      </View>
      {questsOpen && (
        <View style={[styles.quests, { top: insets.top + 50, maxHeight: area.h * 0.6 }]}>
          <Pressable onPress={() => setQuestsOpen(false)} style={styles.questsClose} hitSlop={10}>
            <Text style={styles.closeTxt}>✕</Text>
          </Pressable>
          <ScrollView>
            <Quests />
          </ScrollView>
        </View>
      )}

      {/* смуга цілі дня + буст над карткою */}
      <View pointerEvents="none" style={[styles.goalWrap, { bottom: cardH + 4 }]}>
        <View style={styles.goalBar}>
          <View style={[styles.goalFill, { width: `${goalPct * 100}%` }]} />
        </View>
        <Text style={styles.goalTxt}>
          Ціль дня · {p.goal.label} · {Math.min(p.goal.xp, p.goal.target)}/{p.goal.target} XP
        </Text>
      </View>
      <View style={[styles.boost, { bottom: cardH + 34 }]} pointerEvents="none">
        <BoostBanner />
      </View>

      {/* світла тепла картка завдання (#f7f1e4 → #ece3d0, темний текст, зелена CTA) */}
      <View style={styles.bottom} onLayout={(e) => setCardH(e.nativeEvent.layout.height)}>
        {p.offerAdapt && (
          <View style={styles.offer}>
            <Pressable onPress={() => router.push('/adapt')} style={{ flex: 1 }}>
              <Text style={styles.offerTxt}>🎯 Підлаштувати курс під тебе</Text>
            </Pressable>
            <Pressable onPress={p.onDismissAdapt} hitSlop={10}>
              <Text style={styles.offerX}>✕</Text>
            </Pressable>
          </View>
        )}
        <View style={styles.card}>
          <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
            <Defs>
              <LinearGradient id="warm" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#f7f1e4" />
                <Stop offset="1" stopColor="#ece3d0" />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#warm)" />
          </Svg>
          <Text style={styles.taskLabel}>{p.allDone ? 'КУРС ПРОЙДЕНО' : stop.isChest ? 'ПІДСУМОК МОДУЛЯ' : 'ЗАВДАННЯ'}</Text>
          <Text style={styles.taskTxt} numberOfLines={2}>
            {p.allDone ? 'Усі доступні модулі пройдено. Нові скоро. Повтори пройдене на карті.' : stop.lesson.title}
          </Text>
          <View style={{ marginTop: 10 }}>
            {p.allDone ? <Button title="Відкрити карту" onPress={p.onMap} /> : <Button title={stop.isChest ? 'Відкрити скриню' : 'Увійти'} onPress={() => void enter(stop.lesson.id)} />}
          </View>
        </View>
      </View>
    </View>
  );
}

// Контактна тінь під ступнями: м'який темний еліпс (без неї фігура «висить»)
function ContactShadow({ w, y }: { w: number; y: number }) {
  const h = Math.max(10, w * 0.17);
  return (
    <Svg pointerEvents="none" width={w} height={h} style={{ position: 'absolute', left: '50%', marginLeft: -w / 2, top: y - h * 0.5 }}>
      <Defs>
        <RadialGradient id="cs" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#000" stopOpacity={0.85} />
          <Stop offset="0.6" stopColor="#000" stopOpacity={0.5} />
          <Stop offset="1" stopColor="#000" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={w} height={h} fill="url(#cs)" rx={h / 2} />
    </Svg>
  );
}

const glass = 'rgba(13,15,20,0.55)';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1612', overflow: 'hidden' },
  hud: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center' },
  mapBtn: { paddingHorizontal: 12, borderColor: '#36e27a' },
  mapIco: { fontSize: 15 },
  mapTxt: { color: '#eef2f7', fontWeight: '900', fontSize: 13 },
  titleBox: { position: 'absolute', left: 14, right: 70 },
  kicker: { alignSelf: 'flex-start', backgroundColor: '#36e27a', color: '#0d0f14', fontWeight: '900', fontSize: 11, letterSpacing: 1.4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden' },
  side: { position: 'absolute', right: 12, gap: 10 },
  sideBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: glass, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  sideIco: { fontSize: 21 },
  sideBadge: { position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#36e27a', color: '#0d0f14', fontWeight: '900', fontSize: 11, textAlign: 'center', lineHeight: 20, overflow: 'hidden' },
  quests: { position: 'absolute', right: 64, left: 12, backgroundColor: 'rgba(13,15,20,0.92)', borderRadius: 18, borderWidth: 2, borderColor: '#262c38', padding: 6, zIndex: 5 },
  questsClose: { position: 'absolute', right: 10, top: 6, zIndex: 2 },
  closeTxt: { color: '#eef2f7', fontWeight: '900', fontSize: 16 },
  goalWrap: { position: 'absolute', left: 16, right: 16 },
  goalBar: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  goalFill: { height: '100%', backgroundColor: '#4aa8ff', borderRadius: 3 },
  goalTxt: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700', marginTop: 3, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4 },
  boost: { position: 'absolute', left: 12, right: 12 },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingBottom: 12 },
  card: { borderRadius: 20, borderWidth: 2, borderBottomWidth: 5, borderColor: '#d9ceb4', padding: 14, overflow: 'hidden' },
  taskLabel: { color: '#1c8f4f', fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },
  taskTxt: { color: '#2a2418', fontSize: 17, fontWeight: '800', marginTop: 3 },
  offer: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(247,241,228,0.96)', borderRadius: 14, paddingVertical: 9, paddingHorizontal: 14, marginBottom: 8, borderWidth: 1, borderColor: '#d9ceb4' },
  offerTxt: { color: '#2a2418', fontWeight: '800', fontSize: 13 },
  offerX: { color: '#6b604a', fontWeight: '900', fontSize: 14 },
  bubble: { position: 'absolute', width: 214, backgroundColor: 'rgba(247,241,228,0.97)', borderRadius: 16, paddingVertical: 9, paddingHorizontal: 12, borderWidth: 1, borderColor: '#d9ceb4' },
  bubbleTxt: { color: '#2a2418', fontWeight: '700', fontSize: 13, lineHeight: 17 },
  badge: { position: 'absolute', left: 0, right: 0, top: -4, alignItems: 'center' },
  badgeTxt: { backgroundColor: 'rgba(13,15,20,0.85)', color: '#fff', fontWeight: '900', fontSize: 11, paddingHorizontal: 9, paddingVertical: 3, borderRadius: 11, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
});
