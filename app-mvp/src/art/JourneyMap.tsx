// ВИД-КАРТА (з неба): стилізований Київ із ПІНАМИ-ЛОКАЦІЯМИ, позначкою гравця (Гріндік), прокладеним маршрутом від околиці до Печерська
// й станами пройдено / поточний (зелений) / заблоковано (ТЗ A2). Це карта міста, а не вертикальний ланцюг: пін = заклад на карті,
// маршрут = дорога через місто, річка, парки, метро й райони. Тап по піну відкриває список зупинок модуля (повтор пройденого).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PoseImage } from '../components/PoseImage';
import { MODULES } from '../data/modules';
import { pose } from '../data/poses';
import { Hud, hudPill } from './Hud';
import { LOCS, MODULE_HUB, actOfModule } from './levels';
import { stopsOfModule } from './stops';

// Позиції пінів модулів на карті (частки полотна). Маршрут: околиця (внизу ліворуч) → Печерськ (угорі).
const PINS: Record<number, { x: number; y: number }> = {
  1: { x: 0.2, y: 0.93 },
  2: { x: 0.5, y: 0.86 },
  3: { x: 0.78, y: 0.77 },
  4: { x: 0.55, y: 0.67 },
  5: { x: 0.24, y: 0.6 },
  6: { x: 0.3, y: 0.47 },
  7: { x: 0.58, y: 0.4 },
  8: { x: 0.7, y: 0.3 },
  9: { x: 0.64, y: 0.19 },
  10: { x: 0.34, y: 0.08 },
};

const DISTRICTS = [
  { t: 'ОКОЛИЦЯ', x: 0.08, y: 0.86 },
  { t: 'ПОДІЛ', x: 0.42, y: 0.76 },
  { t: 'ХРЕЩАТИК', x: 0.34, y: 0.56 },
  { t: 'ЛІВИЙ БЕРЕГ', x: 0.8, y: 0.52 },
  { t: 'ОБОЛОНЬ', x: 0.1, y: 0.2 },
  { t: 'ПЕЧЕРСЬК', x: 0.5, y: 0.04 },
];

const WATER = '#9fd0ef';
const LAND = '#ece4d1';
const BLOCK = '#e0d6bf';
const PARK = '#bfdc9f';

// гладка крива через точки (Catmull-Rom → Безьє)
function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

export type MapProps = {
  completed: string[];
  currentModule: number; // 1..10
  onClose: () => void;
  onOpenLesson: (id: string) => void;
};

export function JourneyMap({ completed, currentModule, onClose, onOpenLesson }: MapProps) {
  const insets = useSafeAreaInsets();
  const { width: winW, height: winH } = useWindowDimensions();
  const W = Math.min(winW, 560);
  const H = Math.round(W * 2.0);
  const [sel, setSel] = useState<number | null>(null);
  const scroll = useRef<ScrollView>(null);
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const l = Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: false }), Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: false })]));
    l.start();
    return () => l.stop();
  }, [bob]);

  useEffect(() => {
    const y = PINS[currentModule].y * H - winH / 2 + insets.top + 130;
    const t = setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, y), animated: false }), 30);
    return () => clearTimeout(t);
  }, [currentModule, H, winH]);

  // прогрес за модулями
  const prog = useMemo(
    () =>
      MODULES.map((m, i) => {
        const ids = [...m.lessons.map((l) => l.id), m.checkpoint.id];
        const done = ids.filter((id) => completed.includes(id)).length;
        return { n: i + 1, done, total: ids.length, finished: done === ids.length, title: LOCS[MODULE_HUB[i + 1]]?.title ?? m.title };
      }),
    [completed]
  );

  const pts = Array.from({ length: 10 }, (_, i) => ({ x: PINS[i + 1].x * W, y: PINS[i + 1].y * H }));
  const upto = pts.slice(0, currentModule); // пройдена частина маршруту: до поточного піна включно
  const metroLine = (c: string, ps: [number, number][]) => ({ c, d: smooth(ps.map(([x, y]) => ({ x: x * W, y: y * H }))) });
  const metro = [metroLine('#e4572e', [[0.05, 0.9], [0.3, 0.74], [0.5, 0.56], [0.62, 0.34], [0.55, 0.05]]), metroLine('#2f6fde', [[0.05, 0.45], [0.3, 0.5], [0.58, 0.52], [0.95, 0.6]]), metroLine('#2eae6b', [[0.2, 0.2], [0.42, 0.3], [0.6, 0.62], [0.72, 0.95]])];
  const sp = pose('wave');
  const selStops = sel ? stopsOfModule(sel) : [];

  return (
    <View style={styles.root}>
      <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ width: winW, alignItems: 'center', paddingTop: insets.top + 96, paddingBottom: 40 }}>
        <View style={{ width: W, height: H }}>
          <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="river" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#8cc3e8" />
                <Stop offset="1" stopColor="#a9d8f2" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={W} height={H} fill={LAND} />
            {/* квартали */}
            {Array.from({ length: 70 }, (_, i) => {
              const gx = (i % 7) / 7;
              const gy = Math.floor(i / 7) / 10;
              const jx = ((i * 37) % 11) / 90;
              const jy = ((i * 53) % 13) / 140;
              return <Rect key={i} x={(gx + jx) * W + 4} y={(gy + jy) * H + 4} width={W / 7 - 18 - ((i * 13) % 10)} height={H / 10 - 22 - ((i * 7) % 12)} rx={6} fill={BLOCK} />;
            })}
            {/* парки */}
            {[[0.14, 0.7, 40], [0.45, 0.28, 46], [0.8, 0.88, 38], [0.18, 0.34, 34], [0.68, 0.55, 32]].map(([x, y, r], i) => (
              <Circle key={i} cx={x * W} cy={y * H} r={r} fill={PARK} opacity={0.85} />
            ))}
            {/* Дніпро */}
            <Path d={`M${0.56 * W} ${-0.02 * H} C${0.62 * W} ${0.1 * H} ${0.74 * W} ${0.14 * H} ${0.8 * W} ${0.26 * H} S${0.92 * W} ${0.45 * H} ${0.88 * W} ${0.58 * H} S${0.99 * W} ${0.82 * H} ${0.94 * W} ${1.02 * H}`} stroke="url(#river)" strokeWidth={W * 0.16} fill="none" strokeLinecap="round" />
            <Path d={`M${0.56 * W} ${-0.02 * H} C${0.62 * W} ${0.1 * H} ${0.74 * W} ${0.14 * H} ${0.8 * W} ${0.26 * H} S${0.92 * W} ${0.45 * H} ${0.88 * W} ${0.58 * H} S${0.99 * W} ${0.82 * H} ${0.94 * W} ${1.02 * H}`} stroke="#d4ecfa" strokeWidth={3} fill="none" opacity={0.7} strokeDasharray="2 14" />
            {/* лінії метро */}
            {metro.map((m, i) => (
              <Path key={i} d={m.d} stroke={m.c} strokeWidth={5} fill="none" opacity={0.55} strokeLinecap="round" />
            ))}
            {/* райони */}
            {DISTRICTS.map((d) => (
              <SvgText key={d.t} x={d.x * W} y={d.y * H} fontSize={11} fontWeight="800" letterSpacing={2.4} fill="#9a8f76" opacity={0.7}>
                {d.t}
              </SvgText>
            ))}
            {/* маршрут: майбутнє пунктиром, пройдене зеленим із білою підкладкою */}
            <Path d={smooth(pts)} stroke="#fff" strokeWidth={13} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Path d={smooth(pts)} stroke="#b7ad95" strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray="1 11" />
            {upto.length > 1 && <Path d={smooth(upto)} stroke="#fff" strokeWidth={14} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
            {upto.length > 1 && <Path d={smooth(upto)} stroke="#36e27a" strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          </Svg>

          {/* піни-локації */}
          {prog.map((m) => {
            const pos = PINS[m.n];
            const isCur = m.n === currentModule;
            const locked = m.n > currentModule;
            const color = m.finished ? '#36e27a' : isCur ? '#36e27a' : '#b4ab94';
            const selOn = sel === m.n;
            return (
              <Pressable key={m.n} onPress={() => (locked ? null : setSel(selOn ? null : m.n))} style={{ position: 'absolute', left: pos.x * W - 26, top: pos.y * H - 62, width: 52, alignItems: 'center', opacity: locked ? 0.7 : 1 }} accessibilityLabel={`Локація ${m.title}`}>
                {isCur && (
                  <Animated.View style={{ position: 'absolute', top: -70, transform: [{ translateY: Animated.multiply(bob, -5) }] }}>
                    <PoseImage p={sp} height={66} shadow={0} />
                  </Animated.View>
                )}
                <Svg width={52} height={62} viewBox="0 0 52 62">
                  <Path d="M26 60 C26 60 6 38 6 24 A20 20 0 0 1 46 24 C46 38 26 60 26 60 Z" fill="rgba(0,0,0,0.2)" transform="translate(2 3)" />
                  <Path d="M26 60 C26 60 6 38 6 24 A20 20 0 0 1 46 24 C46 38 26 60 26 60 Z" fill={color} stroke={selOn ? '#1b1b1b' : '#fff'} strokeWidth={3} />
                  <Circle cx={26} cy={24} r={12} fill={locked ? '#d8d0bc' : '#fff'} />
                </Svg>
                <Text style={[styles.pinNum, { color: locked ? '#8a826c' : '#1c8f4f' }]}>{locked ? '🔒' : m.finished ? '✓' : m.n}</Text>
                <View style={styles.pinLabel}>
                  <Text style={styles.pinLabelTxt} numberOfLines={1}>
                    {m.title}
                  </Text>
                  <Text style={styles.pinSub}>
                    АКТ {actOfModule(m.n).n} · {m.done}/{m.total}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* шапка */}
      <View pointerEvents="box-none" style={[styles.top, { top: insets.top + 6 }]}>
        <Pressable onPress={onClose} style={[hudPill, { borderColor: '#36e27a', paddingHorizontal: 12 }]} accessibilityLabel="Повернутись у сцену">
          <Text style={styles.back}>◀ У сцену</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Hud />
      </View>
      <View pointerEvents="none" style={[styles.title, { top: insets.top + 50 }]}>
        <Text style={styles.titleTxt}>КИЇВ</Text>
        <Text style={styles.titleSub}>Акт {actOfModule(currentModule).n} · {actOfModule(currentModule).title}. Маршрут від околиці до Печерська</Text>
      </View>

      {/* список зупинок вибраного модуля */}
      {sel != null && (
        <View style={styles.sheet}>
          <View style={styles.sheetHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetKick}>
                МОДУЛЬ {String(sel).padStart(2, '0')} · {LOCS[MODULE_HUB[sel]].title.toUpperCase()}
              </Text>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {MODULES[sel - 1].title}
              </Text>
            </View>
            <Pressable onPress={() => setSel(null)} hitSlop={10}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={{ maxHeight: winH * 0.34 }}>
            {selStops.map((s) => {
              const done = completed.includes(s.lesson.id);
              const isNow = sel === currentModule && !done && selStops.find((x) => !completed.includes(x.lesson.id))?.lesson.id === s.lesson.id;
              const locked = !done && !isNow;
              return (
                <Pressable key={s.lesson.id} disabled={locked} onPress={() => (isNow ? onClose() : onOpenLesson(s.lesson.id))} style={[styles.row, isNow && styles.rowNow, locked && { opacity: 0.5 }]}>
                  <Text style={[styles.rowCode, done && { color: '#1c8f4f' }]}>{done ? '✓' : locked ? '🔒' : '●'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {s.isChest ? 'Скриня золота' : `${s.lesson.code} · ${s.lesson.title}`}
                    </Text>
                    <Text style={styles.rowLoc}>{s.loc.title}</Text>
                  </View>
                  <Text style={styles.rowGo}>{isNow ? 'їхати' : done ? 'повтор' : ''}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LAND },
  top: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', alignItems: 'center' },
  back: { color: '#eef2f7', fontWeight: '900', fontSize: 13 },
  title: { position: 'absolute', left: 16 },
  titleTxt: { color: '#2a2418', fontWeight: '900', fontSize: 30, letterSpacing: 3, textShadowColor: '#fff', textShadowRadius: 6 },
  titleSub: { color: '#6b604a', fontWeight: '700', fontSize: 12, textShadowColor: '#fff', textShadowRadius: 4 },
  pinNum: { position: 'absolute', top: 14, fontWeight: '900', fontSize: 15 },
  pinLabel: { marginTop: -2, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, alignItems: 'center', minWidth: 74, borderWidth: 1, borderColor: '#d9ceb4' },
  pinLabelTxt: { color: '#2a2418', fontWeight: '800', fontSize: 11, maxWidth: 150 },
  pinSub: { color: '#6b604a', fontWeight: '700', fontSize: 9 },
  sheet: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: 'rgba(247,241,228,0.98)', borderRadius: 20, borderWidth: 2, borderBottomWidth: 5, borderColor: '#d9ceb4', padding: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  sheetKick: { color: '#1c8f4f', fontWeight: '900', fontSize: 10, letterSpacing: 1.3 },
  sheetTitle: { color: '#2a2418', fontWeight: '900', fontSize: 16 },
  close: { color: '#6b604a', fontWeight: '900', fontSize: 16, paddingHorizontal: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 12 },
  rowNow: { backgroundColor: 'rgba(54,226,122,0.2)' },
  rowCode: { width: 22, textAlign: 'center', color: '#6b604a', fontWeight: '900' },
  rowTitle: { color: '#2a2418', fontWeight: '800', fontSize: 13 },
  rowLoc: { color: '#7d725a', fontSize: 11, fontWeight: '600' },
  rowGo: { color: '#1c8f4f', fontWeight: '900', fontSize: 11 },
});
