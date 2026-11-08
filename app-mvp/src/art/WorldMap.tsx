// «ПОДОРОЖ МІСТОМ»: головний екран «Уроки» як світ, а не ланцюг вузлів (див. docs/WORLD_JOURNEY_SPEC.md).
//  • повноекранна локація поточного модуля, ширша за екран: гравець панорамує її свайпом, гіро/миша зсувають шари з різною швидкістю;
//  • уроки це світні «площадки» на підлозі сцени (у координатах сцени, рухаються разом із нею), Гріндік-cutout стоїть на поточній і
//    ІДЕ до наступної після уроку; квізи це NPC у сцені, скриня золота справжня скриня наприкінці локації;
//  • тап по площадці зумить у неї й відкриває урок; після скрині камера їде в наступну локацію сценою «в дорозі» (транспорт за прогресом);
//  • погода й час доби живі на карті.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useIsFocused, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BoostBanner } from '../components/BoostBanner';
import { Quests } from '../components/Quests';
import { PoseImage } from '../components/PoseImage';
import { MODULES, PATH } from '../data/modules';
import { pose, type PoseName } from '../data/poses';
import { useStore } from '../store';
import { art, figureShadow, type ArtKey } from './index';
import { FLOOR_Y, LEVEL_SCENES, TRAVEL_LABEL, TRAVEL_TO, type LevelScene, type TravelMode } from './levels';
import { Hud } from './LevelSplash';
import { ObjectiveGlow } from './ObjectiveGlow';
import { useTilt } from './tilt';
import { WeatherOverlay, useSceneState } from './WeatherOverlay';

const NPCS: ArtKey[] = ['cutout/npc/barista', 'cutout/npc/colleague', 'cutout/npc/rival', 'cutout/npc/teamlead'];

export type WorldMapProps = {
  completed: string[];
  onOpen: (id: string) => void;
  talk: { text: string; pose: PoseName };
  onTalk: () => void;
  goal: { xp: number; target: number; label: string };
  claimable: number;
  dueCount: number;
  offerAdapt: boolean;
  onDismissAdapt: () => void;
};

// ───────── дані модуля ─────────
function stopsOf(mi: number, completed: string[]) {
  const m = MODULES[mi];
  const lessons = m.lessons.map((l) => ({ lesson: l, done: completed.includes(l.id) }));
  const firstOpen = lessons.findIndex((s) => !s.done);
  const chestDone = completed.includes(m.checkpoint.id);
  const quizzes = m.quizzes.map((q) => {
    const idxs = (q.requires ?? []).map((id) => m.lessons.findIndex((l) => l.id === id));
    return { quiz: q, after: idxs.length ? Math.max(...idxs) : 0, unlocked: (q.requires ?? []).every((id) => completed.includes(id)), done: completed.includes(q.id) };
  });
  const L = lessons.length;
  const cur = firstOpen >= 0 ? firstOpen : L; // L = скриня
  const padIds = [...m.lessons.map((l) => l.id), m.checkpoint.id];
  return { m, lessons, quizzes, chestDone, cur, L, padIds };
}

export function WorldMap(p: WorldMapProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const focused = useIsFocused();
  const { width: winW, height: winH } = useWindowDimensions();
  const [area, setArea] = useState({ w: winW, h: Math.max(400, winH - 90) });
  const tilt = useTilt(true);
  const weather = useSceneState();

  const worldPos = useStore((s) => s.worldPos);
  const worldModule = useStore((s) => s.worldModule);
  const setWorldPos = useStore((s) => s.setWorldPos);
  const setWorldModule = useStore((s) => s.setWorldModule);

  // який модуль зараз «живий» (перший з непройденим уроком)
  const currentModule = useMemo(() => {
    const it = PATH.find((x) => !p.completed.includes(x.lesson.id));
    return it ? it.moduleIndex : MODULES.length - 1;
  }, [p.completed]);
  const [view, setView] = useState(currentModule);
  const [interlude, setInterlude] = useState<{ from: LevelScene; to: LevelScene; mode: TravelMode } | null>(null);
  const [questsOpen, setQuestsOpen] = useState(false);

  // Перехід у нову локацію: «в дорозі». Першого разу (worldModule === null) просто запам'ятовуємо місце без показу.
  useEffect(() => {
    if (worldModule === null) {
      setWorldModule(currentModule);
      return;
    }
    if (currentModule > worldModule) {
      const to = LEVEL_SCENES[currentModule + 1];
      const from = LEVEL_SCENES[currentModule] ?? to;
      setInterlude({ from, to, mode: TRAVEL_TO[currentModule + 1] ?? 'marshrutka' });
      const t = setTimeout(() => {
        setInterlude(null);
        setWorldModule(currentModule);
        setView(currentModule);
      }, 4300);
      return () => clearTimeout(t);
    }
    setView((v) => (v > currentModule ? currentModule : v));
  }, [currentModule, worldModule, setWorldModule]);

  const scene = LEVEL_SCENES[view + 1] ?? LEVEL_SCENES[1];
  const st = useMemo(() => stopsOf(view, p.completed), [view, p.completed]);
  const live = view === currentModule; // Гріндік і «поточна» підсвітка лише в живій локації

  // ───────── геометрія плити ─────────
  const plate = art(scene.plate);
  const scale = Math.max(area.h / plate.h, (area.w * 1.15) / plate.w);
  const plateW = plate.w * scale;
  const plateH = plate.h * scale;
  const plateTop = (area.h - plateH) / 2;
  const u = area.h / 700; // одиниця масштабу під висоту екрана
  const floor = FLOOR_Y[view + 1] ?? 0.74;
  const n = st.L + 1;
  const padPos = useCallback(
    (i: number) => {
      const fx = 0.12 + 0.76 * (n > 1 ? i / (n - 1) : 0.5);
      const fy = floor + 0.022 * Math.sin(i * 1.25);
      const s = Math.max(0.78, Math.min(1.2, 0.8 + (fy - 0.5) * 0.9));
      return { x: fx * plateW, y: plateTop + fy * plateH, s };
    },
    [n, floor, plateW, plateH, plateTop]
  );

  // ───────── панорама ─────────
  const scrollRef = useRef<ScrollView>(null);
  const scrollX = useRef(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollX.current = e.nativeEvent.contentOffset.x;
  };
  useEffect(() => {
    const tx = Math.max(0, Math.min(plateW - area.w, padPos(st.cur).x - area.w / 2));
    const t = setTimeout(() => scrollRef.current?.scrollTo({ x: tx, animated: true }), 60);
    return () => clearTimeout(t);
  }, [view, st.cur, plateW, area.w, padPos]);

  // ───────── Гріндік: стоїть на поточній площадці й ІДЕ до нової ─────────
  const actor = useRef(new Animated.ValueXY({ x: -999, y: 0 })).current;
  const bob = useRef(new Animated.Value(0)).current;
  const [facing, setFacing] = useState(1);
  const [walking, setWalking] = useState(false);
  const curPos = padPos(st.cur);
  const curId = st.padIds[st.cur];
  useEffect(() => {
    if (!live || area.h < 100) return;
    const to = { x: curPos.x, y: curPos.y };
    const fromIdx = worldPos ? st.padIds.indexOf(worldPos) : -1;
    if (fromIdx >= 0 && fromIdx !== st.cur) {
      const from = padPos(fromIdx);
      actor.setValue({ x: from.x, y: from.y });
      setFacing(to.x >= from.x ? 1 : -1);
      setWalking(true);
      const loop = Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 170, useNativeDriver: false }), Animated.timing(bob, { toValue: 0, duration: 170, useNativeDriver: false })]));
      loop.start();
      Animated.timing(actor, { toValue: to, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start(() => {
        loop.stop();
        bob.setValue(0);
        setWalking(false);
        setWorldPos(curId);
      });
    } else {
      actor.setValue(to);
      if (worldPos !== curId) setWorldPos(curId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, curId, plateW, plateH, area.h]);

  // ───────── зум у площадку й відкриття уроку ─────────
  const zoom = useRef(new Animated.Value(0)).current;
  const [origin, setOrigin] = useState('50% 50%');
  useEffect(() => {
    if (focused) zoom.setValue(0); // повернулись з уроку: камера знову на місці
  }, [focused, zoom]);
  const go = (id: string, x: number, y: number) => {
    setOrigin(`${Math.round(x - scrollX.current)}px ${Math.round(y)}px`);
    Animated.timing(zoom, { toValue: 1, duration: 340, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(() => p.onOpen(id));
  };

  const plateShift = Animated.multiply(tilt.x, -10);
  const actorShift = Animated.multiply(tilt.x, -24);
  const goalPct = Math.min(1, p.goal.xp / Math.max(1, p.goal.target));

  // ───────── рендер ─────────
  const gH = area.h * 0.3; // висота Гріндіка на площадці (далі від глядача менший)
  const gp = pose('stand');
  const npcH = area.h * 0.26;

  return (
    <View style={styles.root} onLayout={(e) => setArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <Animated.View style={{ flex: 1, transformOrigin: origin as unknown as string, transform: [{ scale: zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.55] }) }] } as object}>
        <ScrollView ref={scrollRef} horizontal showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16} decelerationRate="fast" contentContainerStyle={{ width: plateW }}>
          <View style={{ width: plateW, height: area.h, overflow: 'hidden' }}>
            {/* світ */}
            <Animated.View style={{ position: 'absolute', left: 0, top: plateTop, width: plateW, height: plateH, transform: [{ translateX: plateShift }, { scale: 1.05 }] }}>
              <Image source={plate.src} style={{ width: plateW, height: plateH }} resizeMode="stretch" />
            </Animated.View>

            {/* актори: площадки, NPC, скриня, Гріндік (зсуваються швидше за плиту: глибина) */}
            <Animated.View style={{ position: 'absolute', left: 0, top: 0, width: plateW, height: area.h, transform: [{ translateX: actorShift }] }}>
              {/* NPC-квізи між площадками */}
              {st.quizzes.map((q, qi) => {
                const a = padPos(Math.min(q.after, st.L - 1));
                const b = padPos(Math.min(q.after + 1, st.L));
                const x = (a.x + b.x) / 2;
                const y = (a.y + b.y) / 2 - area.h * 0.025;
                const s = (a.s + b.s) / 2 * 0.95;
                const key = NPCS[(view + qi) % NPCS.length];
                const e = art(key);
                const h = npcH * s;
                return (
                  <Pressable key={q.quiz.id} onPress={() => (q.unlocked ? go(q.quiz.id, x, y - h / 2) : p.onTalk())} style={{ position: 'absolute', left: x - (h * e.ratio) / 2, top: y - h, width: h * e.ratio, height: h, opacity: q.unlocked || q.done ? 1 : 0.45 }}>
                    <PoseImage p={{ src: e.src, ratio: e.ratio, key }} width={h * e.ratio} height={h} shadow={0.7} />
                    <View style={[styles.badge, { left: (h * e.ratio) / 2 - 18, top: -6 }, q.done && styles.badgeDone]}>
                      <Text style={styles.badgeTxt}>{q.done ? '✓' : q.unlocked ? '⏱' : '🔒'}</Text>
                    </View>
                  </Pressable>
                );
              })}

              {/* площадки-уроки на підлозі */}
              {st.lessons.map((s, i) => {
                const pos = padPos(i);
                const isCur = live && i === st.cur;
                const locked = !s.done && !isCur && !(!live);
                const lockedHere = !s.done && i !== st.cur;
                return <Pad key={s.lesson.id} x={pos.x} y={pos.y} s={pos.s * u} done={s.done} current={isCur} locked={lockedHere && live} dim={!live && !s.done} label={s.lesson.code} title={isCur ? s.lesson.title : undefined} onPress={() => (lockedHere && live ? p.onTalk() : go(s.lesson.id, pos.x, pos.y))} _unused={locked} />;
              })}

              {/* скриня золота */}
              {(() => {
                const pos = padPos(st.L);
                const isCur = live && st.cur === st.L;
                const key: ArtKey = st.chestDone ? 'fx/objects/chest_open' : 'fx/objects/chest_closed';
                const e = art(key);
                const h = 96 * pos.s * u;
                const reachable = st.cur >= st.L;
                return (
                  <>
                    {isCur && <ObjectiveGlow x={pos.x} y={pos.y - h * 0.4} radius={120 * u} intensity={1.3} />}
                    <Pressable onPress={() => (reachable || st.chestDone ? go(st.m.checkpoint.id, pos.x, pos.y - h / 2) : p.onTalk())} style={{ position: 'absolute', left: pos.x - (h * e.ratio) / 2, top: pos.y - h, width: h * e.ratio, height: h, opacity: reachable || st.chestDone ? 1 : 0.55 }}>
                      <Image source={e.src} style={[{ width: h * e.ratio, height: h }, figureShadow(0.7)]} resizeMode="contain" />
                    </Pressable>
                  </>
                );
              })()}

              {/* Гріндік */}
              {live && (
                <Animated.View
                  pointerEvents="box-none"
                  style={{
                    position: 'absolute',
                    width: gH * gp.ratio,
                    height: gH,
                    left: Animated.subtract(actor.x, (gH * gp.ratio) / 2),
                    top: Animated.add(Animated.subtract(actor.y, gH * 0.97), Animated.multiply(bob, -6)),
                    transform: [{ scaleX: facing }],
                  }}
                >
                  <PoseImage p={gp} width={gH * gp.ratio} height={gH} />
                </Animated.View>
              )}
              {live && !walking && (
                <Pressable onPress={p.onTalk} style={[styles.bubble, { left: Math.max(8, Math.min(plateW - 218, curPos.x - 110)), top: Math.max(insets.top + 150, curPos.y - gH - 62) }]}>
                  <Text style={styles.bubbleTxt} numberOfLines={3}>
                    {p.talk.text}
                  </Text>
                </Pressable>
              )}
            </Animated.View>
          </View>
        </ScrollView>
      </Animated.View>

      {/* віньєтка: фіксована поверх світу */}
      <Svg pointerEvents="none" width={area.w} height={area.h} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="wvig" cx="50%" cy="50%" r="78%">
            <Stop offset="0.5" stopColor="#05070a" stopOpacity={0} />
            <Stop offset="1" stopColor="#05070a" stopOpacity={0.5} />
          </RadialGradient>
          <LinearGradient id="wvigT" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#05070a" stopOpacity={0.62} />
            <Stop offset="1" stopColor="#05070a" stopOpacity={0} />
          </LinearGradient>
          <LinearGradient id="wvigB" x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" stopColor="#05070a" stopOpacity={0.5} />
            <Stop offset="1" stopColor="#05070a" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={area.w} height={area.h} fill="url(#wvig)" />
        <Rect x={0} y={0} width={area.w} height={area.h * 0.24} fill="url(#wvigT)" />
        <Rect x={0} y={area.h * 0.8} width={area.w} height={area.h * 0.2} fill="url(#wvigB)" />
      </Svg>
      <WeatherOverlay state={weather} />

      {/* HUD */}
      <View pointerEvents="box-none" style={[styles.hud, { top: insets.top + 6 }]}>
        <View style={{ flex: 1 }} />
        <Hud />
      </View>
      <View pointerEvents="box-none" style={[styles.switcher, { top: insets.top + 50 }]}>
        <Pressable disabled={view <= 0} onPress={() => setView((v) => Math.max(0, v - 1))} style={[styles.arrow, view <= 0 && { opacity: 0.3 }]} hitSlop={8}>
          <Text style={styles.arrowTxt}>‹</Text>
        </Pressable>
        <View style={styles.locPill}>
          <Text style={styles.locKick}>
            МОДУЛЬ {String(view + 1).padStart(2, '0')} · {st.lessons.filter((x) => x.done).length}/{st.L}
          </Text>
          <Text style={styles.locTitle} numberOfLines={1}>
            {scene.title}
          </Text>
        </View>
        <Pressable disabled={view >= currentModule} onPress={() => setView((v) => Math.min(currentModule, v + 1))} style={[styles.arrow, view >= currentModule && { opacity: 0.3 }]} hitSlop={8}>
          <Text style={styles.arrowTxt}>›</Text>
        </Pressable>
      </View>
      <View pointerEvents="none" style={[styles.goalWrap, { top: insets.top + 106 }]}>
        <View style={styles.goalBar}>
          <View style={[styles.goalFill, { width: `${goalPct * 100}%` }]} />
        </View>
        <Text style={styles.goalTxt}>
          Ціль дня · {p.goal.label} · {Math.min(p.goal.xp, p.goal.target)}/{p.goal.target} XP
        </Text>
      </View>
      <View style={[styles.boost, { top: insets.top + 134 }]} pointerEvents="box-none">
        <BoostBanner />
      </View>

      {/* швидкі входи: завдання, симулятор, тренування */}
      <View style={[styles.side, { top: insets.top + 160 }]}>
        <Pressable onPress={() => setQuestsOpen((o) => !o)} style={[styles.sideBtn, p.claimable > 0 && { borderColor: '#36e27a' }]} accessibilityLabel="Завдання дня">
          <Text style={styles.sideIco}>🌟</Text>
          {p.claimable > 0 && <Text style={styles.sideBadge}>{p.claimable}</Text>}
        </Pressable>
        <Pressable onPress={() => router.push('/sim')} style={styles.sideBtn} accessibilityLabel="Симулятор кампанії">
          <Text style={styles.sideIco}>📊</Text>
        </Pressable>
        {p.completed.length >= 2 && (
          <Pressable onPress={() => router.push('/lesson/practice')} style={styles.sideBtn} accessibilityLabel="Швидке тренування">
            <Text style={styles.sideIco}>🏋️</Text>
            {p.dueCount > 0 && <Text style={styles.sideBadge}>{p.dueCount}</Text>}
          </Pressable>
        )}
      </View>
      {questsOpen && (
        <View style={[styles.quests, { top: insets.top + 160, maxHeight: area.h * 0.6 }]}>
          <Pressable onPress={() => setQuestsOpen(false)} style={styles.questsClose} hitSlop={10}>
            <Text style={styles.arrowTxt}>✕</Text>
          </Pressable>
          <ScrollView>
            <Quests />
          </ScrollView>
        </View>
      )}
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

      {/* перехід «в дорозі» між локаціями */}
      {interlude && <Interlude from={interlude.from} to={interlude.to} mode={interlude.mode} />}
    </View>
  );
}

// ───────── площадка-урок на підлозі сцени ─────────
function Pad({ x, y, s, done, current, locked, dim, label, title, onPress }: { x: number; y: number; s: number; done: boolean; current: boolean; locked: boolean; dim: boolean; label: string; title?: string; onPress: () => void; _unused?: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const focused = useIsFocused();
  useEffect(() => {
    if (!current || !focused) return;
    const loop = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: false }), Animated.timing(pulse, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: false })]));
    loop.start();
    return () => loop.stop();
  }, [current, focused, pulse]);
  const rx = 38 * s;
  const ry = 13 * s;
  const w = rx * 2 + 24;
  const h = ry * 2 + 24;
  const color = done ? '#36e27a' : current ? '#6dffa8' : '#cfd6de';
  return (
    <Pressable onPress={onPress} style={{ position: 'absolute', left: x - w / 2, top: y - h / 2, width: w, height: h, alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.55 : locked ? 0.6 : 1 }}>
      {current && <ObjectiveGlow x={w / 2} y={h / 2} radius={rx * 2.2} intensity={1.3} pulse />}
      <Animated.View style={current ? { transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] } : undefined}>
        <Svg width={w} height={h}>
          <Ellipse cx={w / 2} cy={h / 2} rx={rx} ry={ry} fill={done ? 'rgba(54,226,122,0.42)' : current ? 'rgba(109,255,168,0.35)' : 'rgba(255,255,255,0.12)'} stroke={color} strokeWidth={current ? 3.5 : 2.5} strokeDasharray={locked ? '4 5' : undefined} />
        </Svg>
      </Animated.View>
      <Text style={[styles.padNum, { top: h / 2 - 9 * s - 22 * s, fontSize: Math.max(12, 15 * s) }]}>{done ? '✓' : locked ? '🔒' : label}</Text>
      {title ? (
        <View style={[styles.padTitle, { top: h / 2 + ry + 4 }]}>
          <Text style={styles.padTitleTxt} numberOfLines={2}>
            {label} · {title}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ───────── сцена «в дорозі» (переїзд між локаціями) ─────────
// Тло тече повз (плита відправлення, потім прибуття), смуги швидкості, машина в'їжджає, їде з підстрибуванням і виїжджає;
// у метро замість машини тунель із вогнями. Тривалість ≈4 с.
function Interlude({ from, to, mode }: { from: LevelScene; to: LevelScene; mode: TravelMode }) {
  const { width, height } = useWindowDimensions();
  const t = useRef(new Animated.Value(0)).current; // 0..1: час усієї сцени
  const bob = useRef(new Animated.Value(0)).current;
  const streak = useRef(new Animated.Value(0)).current;
  const fa = art(mode === 'metro' ? 'worlds/locations/metro' : from.plate);
  const ta = art(mode === 'metro' ? 'worlds/locations/metro' : to.plate);
  const cover = (e: { w: number; h: number }) => {
    const sc = Math.max(height / e.h, (width * 1.6) / e.w);
    return { w: e.w * sc, h: e.h * sc };
  };
  const fs = cover(fa);
  const ts = cover(ta);
  const car = mode === 'metro' ? null : art((`cutout/transport/${mode}`) as ArtKey);
  const carW = Math.min(width * 0.92, 420);
  const carH = car ? carW / car.ratio : 0;

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: 4000, easing: Easing.linear, useNativeDriver: false }).start();
    const l1 = Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 120, useNativeDriver: false }), Animated.timing(bob, { toValue: 0, duration: 120, useNativeDriver: false })]));
    const l2 = Animated.loop(Animated.sequence([Animated.timing(streak, { toValue: 1, duration: 420, easing: Easing.linear, useNativeDriver: false }), Animated.timing(streak, { toValue: 0, duration: 0, useNativeDriver: false })]));
    l1.start();
    l2.start();
    return () => {
      l1.stop();
      l2.stop();
    };
  }, [t, bob, streak]);

  const fade = t.interpolate({ inputRange: [0, 0.08, 0.92, 1], outputRange: [0, 1, 1, 0] });
  const toFade = t.interpolate({ inputRange: [0.38, 0.62], outputRange: [0, 1], extrapolate: 'clamp' });
  const carX = t.interpolate({ inputRange: [0, 0.2, 0.78, 1], outputRange: [-carW * 1.2, (width - carW) / 2, (width - carW) / 2 + width * 0.06, width + carW * 0.2] });
  const carY = height * 0.58;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, backgroundColor: '#05070a', overflow: 'hidden' }]} pointerEvents="auto">
      <Animated.Image source={fa.src} style={{ position: 'absolute', width: fs.w, height: fs.h, top: (height - fs.h) / 2, left: t.interpolate({ inputRange: [0, 1], outputRange: [-(fs.w - width) * 0.15, -(fs.w - width) * 0.75] }) }} resizeMode="stretch" />
      {mode !== 'metro' && <Animated.Image source={ta.src} style={{ position: 'absolute', opacity: toFade, width: ts.w, height: ts.h, top: (height - ts.h) / 2, left: t.interpolate({ inputRange: [0, 1], outputRange: [-(ts.w - width) * 0.1, -(ts.w - width) * 0.7] }) }} resizeMode="stretch" />}
      <View style={styles.interShade} />

      {/* смуги швидкості (метро: більше й жовтіші, як вогні тунелю) */}
      {Array.from({ length: mode === 'metro' ? 9 : 6 }, (_, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: height * (0.14 + ((i * 0.137) % 0.7)),
            height: mode === 'metro' ? 5 : 2,
            width: width * (0.25 + (i % 3) * 0.12),
            borderRadius: 3,
            backgroundColor: mode === 'metro' ? 'rgba(255,214,120,0.55)' : 'rgba(255,255,255,0.28)',
            left: streak.interpolate({ inputRange: [0, 1], outputRange: [width * (1 + (i % 4) * 0.18), -width * 0.5] }),
          }}
        />
      ))}

      {/* машина їде містом: в'їзд, хід із підстрибуванням, виїзд */}
      {car && (
        <>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', top: carY + carH * 0.9, width: carW * 0.9, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.45)', left: Animated.add(carX, carW * 0.05) }} />
          <Animated.Image
            source={car.src}
            style={[{ position: 'absolute', width: carW, height: carH, top: Animated.add(carY, Animated.multiply(bob, -2.5)), left: carX }, figureShadow(0.5)]}
            resizeMode="contain"
          />
        </>
      )}

      <View style={styles.interText}>
        <Text style={styles.interKick}>У ДОРОЗІ · {TRAVEL_LABEL[mode].toUpperCase()}</Text>
        <Text style={styles.interTitle}>{to.title}</Text>
      </View>
    </Animated.View>
  );
}

const glass = 'rgba(13,15,20,0.55)';
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0d0f14', overflow: 'hidden' },
  hud: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center' },
  switcher: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { width: 36, height: 36, borderRadius: 18, backgroundColor: glass, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  arrowTxt: { color: '#eef2f7', fontSize: 20, fontWeight: '900', lineHeight: 22 },
  locPill: { flex: 1, backgroundColor: glass, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', paddingVertical: 5, paddingHorizontal: 12 },
  locKick: { color: '#36e27a', fontWeight: '900', fontSize: 10, letterSpacing: 1.2 },
  locTitle: { color: '#ffffff', fontWeight: '900', fontSize: 16, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  goalWrap: { position: 'absolute', left: 16, right: 16 },
  goalBar: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  goalFill: { height: '100%', backgroundColor: '#4aa8ff', borderRadius: 3 },
  goalTxt: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '700', marginTop: 3, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 4 },
  boost: { position: 'absolute', left: 12, right: 12 },
  side: { position: 'absolute', right: 12, gap: 10 },
  sideBtn: { width: 46, height: 46, borderRadius: 23, backgroundColor: glass, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  sideIco: { fontSize: 22 },
  sideBadge: { position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#36e27a', color: '#0d0f14', fontWeight: '900', fontSize: 11, textAlign: 'center', lineHeight: 20, overflow: 'hidden' },
  quests: { position: 'absolute', right: 66, left: 12, backgroundColor: 'rgba(13,15,20,0.92)', borderRadius: 18, borderWidth: 2, borderColor: '#262c38', padding: 6 },
  questsClose: { position: 'absolute', right: 10, top: 6, zIndex: 2 },
  offer: { position: 'absolute', left: 14, right: 14, bottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(247,241,228,0.96)', borderRadius: 16, paddingVertical: 11, paddingHorizontal: 14 },
  offerTxt: { color: '#2a2418', fontWeight: '800', fontSize: 14 },
  offerX: { color: '#6b604a', fontWeight: '900', fontSize: 14 },
  bubble: { position: 'absolute', width: 210, backgroundColor: 'rgba(247,241,228,0.96)', borderRadius: 16, paddingVertical: 9, paddingHorizontal: 12 },
  bubbleTxt: { color: '#2a2418', fontWeight: '700', fontSize: 13, lineHeight: 17 },
  badge: { position: 'absolute', minWidth: 36, height: 24, borderRadius: 12, backgroundColor: 'rgba(13,15,20,0.8)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  badgeDone: { backgroundColor: '#36e27a', borderColor: '#36e27a' },
  badgeTxt: { color: '#fff', fontWeight: '900', fontSize: 12 },
  padNum: { position: 'absolute', color: '#ffffff', fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 6 },
  padTitle: { position: 'absolute', maxWidth: 210, backgroundColor: 'rgba(13,15,20,0.78)', borderRadius: 12, paddingVertical: 4, paddingHorizontal: 9 },
  padTitleTxt: { color: '#ffffff', fontWeight: '800', fontSize: 12, textAlign: 'center' },
  interShade: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(5,7,10,0.35)' },
  interText: { position: 'absolute', left: 24, right: 24, bottom: 110 },
  interKick: { color: '#36e27a', fontWeight: '900', letterSpacing: 3, fontSize: 12 },
  interTitle: { color: '#ffffff', fontWeight: '900', fontSize: 34, marginTop: 4, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 12 },
});
