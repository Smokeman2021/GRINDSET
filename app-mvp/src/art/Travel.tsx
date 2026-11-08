// ПЕРЕЇЗД між зупинками (ТЗ A5): не телепорт, а дорога. Транспорт за актом їде екраном (cutout), позаду місто пропливає трьома шарами
// паралаксу + дорога, зверху капають XP/коїни, які щойно заробив гравець. Метро: тунель із вогнями. Пішки: Гріндік іде вулицею.
// Прибуття: оверлей розчиняється, а під ним уже нова сцена. Тап = пропустити.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { PoseImage } from '../components/PoseImage';
import { pose } from '../data/poses';
import { art, figureShadow, type ArtKey } from './index';
import { LessonTitle } from './LessonTitle';
import { TRAVEL_LABEL, type Act, type TravelMode } from './levels';
import type { JStop } from './stops';
import { useSceneState } from './WeatherOverlay';
import { haptic } from '../telegram/webapp';

export type TravelProps = {
  from: JStop;
  to: JStop;
  mode: TravelMode;
  act: Act;
  actChanged: boolean;
  xpGain: number;
  coinGain: number;
  onDone: () => void;
};

// ───────── процедурне місто: смуга будинків, що повторюється ─────────
function rnd(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
type Bld = { x: number; w: number; h: number; wins: { x: number; y: number }[] };
function makeStrip(seed: number, width: number, minH: number, maxH: number, gap: number): Bld[] {
  const r = rnd(seed);
  const out: Bld[] = [];
  let x = 0;
  while (x < width) {
    const w = 38 + r() * 64;
    const h = minH + r() * (maxH - minH);
    const wins: { x: number; y: number }[] = [];
    for (let wx = 8; wx < w - 8; wx += 14) for (let wy = 10; wy < h - 10; wy += 16) if (r() > 0.45) wins.push({ x: wx, y: wy });
    out.push({ x, w, h, wins });
    x += w + gap * r();
  }
  return out;
}

function Strip({ seed, width, height, minH, maxH, gap, color, win, night }: { seed: number; width: number; height: number; minH: number; maxH: number; gap: number; color: string; win: string; night: boolean }) {
  const blds = useMemo(() => makeStrip(seed, width, minH, maxH, gap), [seed, width, minH, maxH, gap]);
  return (
    <Svg width={width} height={height}>
      {blds.map((b, i) => (
        <React.Fragment key={i}>
          <Rect x={b.x} y={height - b.h} width={b.w} height={b.h} fill={color} />
          {b.wins.map((w, j) => (
            <Rect key={j} x={b.x + w.x} y={height - b.h + w.y} width={6} height={8} fill={win} opacity={night ? 0.9 : 0.35} />
          ))}
        </React.Fragment>
      ))}
    </Svg>
  );
}

// Шар, що безкінечно їде вліво зі швидкістю speed (екранів за секунду): дві копії смуги поспіль
function Scroller({ t, speed, width, height, bottom, children }: { t: Animated.Value; speed: number; width: number; height: number; bottom: number; children: (w: number) => React.ReactNode }) {
  const W = width * 1.5; // ширина однієї копії
  const dx = Animated.modulo(Animated.multiply(t, W * speed), W);
  return (
    <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom, left: 0, width: W * 2, height, transform: [{ translateX: Animated.multiply(dx, -1) }] }}>
      <View style={{ flexDirection: 'row' }}>
        {children(W)}
        {children(W)}
      </View>
    </Animated.View>
  );
}

function useCount(target: number, delay: number, dur: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (target <= 0) return;
    const a = new Animated.Value(0);
    const id = a.addListener(({ value }) => setV(Math.round(value)));
    const t = setTimeout(() => Animated.timing(a, { toValue: target, duration: dur, easing: Easing.out(Easing.quad), useNativeDriver: false }).start(), delay);
    return () => {
      clearTimeout(t);
      a.removeListener(id);
    };
  }, [target, delay, dur]);
  return v;
}

export function Travel({ from, to, mode, act, actChanged, xpGain, coinGain, onDone }: TravelProps) {
  const { width, height } = useWindowDimensions();
  const weather = useSceneState();
  const night = weather?.part === 'night';
  const D = actChanged ? 4800 : mode === 'metro' ? 3400 : 3000;
  const t = useRef(new Animated.Value(0)).current; // 0..D мс, лінійно: джерело швидкості шарів (у секундах)
  const prog = useRef(new Animated.Value(0)).current; // 0..1: хід сцени
  const bob = useRef(new Animated.Value(0)).current;
  const doneRef = useRef(false);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    haptic.tap();
    Animated.timing(t, { toValue: D / 1000, duration: D, easing: Easing.linear, useNativeDriver: false }).start();
    Animated.timing(prog, { toValue: 1, duration: D, easing: Easing.linear, useNativeDriver: false }).start(({ finished }) => finished && finish());
    const l = Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 130, useNativeDriver: false }), Animated.timing(bob, { toValue: 0, duration: 130, useNativeDriver: false })]));
    l.start();
    return () => l.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fade = prog.interpolate({ inputRange: [0, 0.07, 0.9, 1], outputRange: [0, 1, 1, 0] });
  const isMetro = mode === 'metro';
  const isWalk = mode === 'walk';
  const car = !isMetro && !isWalk ? art(`cutout/transport/${mode}` as ArtKey) : null;
  const carW = Math.min(width * 0.9, 400);
  const carH = car ? carW / car.ratio : 0;
  const roadH = height * 0.26;
  const carX = prog.interpolate({ inputRange: [0, 0.22, 1], outputRange: [-carW * 1.1, (width - carW) / 2, (width - carW) / 2 + 12] });
  const gp = pose('stand');
  const gH = height * 0.3;
  const sky = night ? ['#0b1530', '#2a2f5a'] : ['#6fa8e0', '#f6d9a8'];

  const xpShown = useCount(xpGain, 700, Math.max(900, D - 1800));
  const coinShown = useCount(coinGain, 900, Math.max(900, D - 1900));
  const drips = useMemo(() => {
    const out: { kind: 'xp' | 'coin'; amt: number; x: number; delay: number }[] = [];
    const nx = Math.min(7, Math.ceil(xpGain / 6));
    const nc = Math.min(6, Math.ceil(coinGain / 8));
    for (let i = 0; i < nx; i++) out.push({ kind: 'xp', amt: Math.max(1, Math.round(xpGain / nx)), x: 0.1 + (i * 0.8) / Math.max(1, nx), delay: 500 + i * 330 });
    for (let i = 0; i < nc; i++) out.push({ kind: 'coin', amt: Math.max(1, Math.round(coinGain / nc)), x: 0.16 + (i * 0.74) / Math.max(1, nc), delay: 700 + i * 380 });
    return out;
  }, [xpGain, coinGain]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade, backgroundColor: '#0b1020', overflow: 'hidden', zIndex: 20 }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityLabel="Пропустити переїзд">
        {isMetro ? <Tunnel t={t} width={width} height={height} /> : (
          <>
            <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
              <Defs>
                <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={sky[0]} />
                  <Stop offset="1" stopColor={sky[1]} />
                </LinearGradient>
              </Defs>
              <Rect x={0} y={0} width={width} height={height} fill="url(#sky)" />
            </Svg>
            {/* три шари міста: далеко (повільно) → близько (швидко) */}
            <Scroller t={t} speed={0.12} width={width} height={height * 0.42} bottom={roadH + height * 0.12}>
              {(w) => <Strip seed={11} width={w} height={height * 0.42} minH={90} maxH={height * 0.4} gap={6} color={night ? '#1b2144' : '#8aa0c4'} win="#ffe9a8" night={night} />}
            </Scroller>
            <Scroller t={t} speed={0.34} width={width} height={height * 0.3} bottom={roadH + height * 0.03}>
              {(w) => <Strip seed={29} width={w} height={height * 0.3} minH={70} maxH={height * 0.28} gap={14} color={night ? '#141a36' : '#6b7fa6'} win="#ffe9a8" night={night} />}
            </Scroller>
            <Scroller t={t} speed={0.9} width={width} height={height * 0.18} bottom={roadH}>
              {(w) => <Strip seed={47} width={w} height={height * 0.18} minH={14} maxH={height * 0.16} gap={90} color={night ? '#0c1024' : '#3d4a66'} win="#ffe9a8" night={night} />}
            </Scroller>
            {/* дорога */}
            <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: roadH, backgroundColor: night ? '#15171d' : '#3a3d45' }}>
              <View style={{ height: 6, backgroundColor: night ? '#2a2d36' : '#8b8f99' }} />
              <Scroller t={t} speed={1.6} width={width} height={10} bottom={roadH * 0.42}>
                {(w) => (
                  <Svg width={w} height={10}>
                    {Array.from({ length: Math.ceil(w / 70) }, (_, i) => (
                      <Rect key={i} x={i * 70} y={2} width={38} height={6} rx={2} fill="#f5f1d8" opacity={0.85} />
                    ))}
                  </Svg>
                )}
              </Scroller>
            </View>
          </>
        )}

        {/* транспорт / Гріндік-пішохід */}
        {car && (
          <>
            <Animated.View pointerEvents="none" style={{ position: 'absolute', top: height - roadH * 0.66 - carH * 0.7 + carH * 0.88, width: carW * 0.86, height: 16, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.5)', left: Animated.add(carX, carW * 0.07) }} />
            <Animated.Image source={car.src} resizeMode="contain" style={[{ position: 'absolute', width: carW, height: carH, top: Animated.add(height - roadH * 0.66 - carH * 0.7, Animated.multiply(bob, -2.5)), left: carX }, figureShadow(0.5)]} />
          </>
        )}
        {isWalk && (
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: width / 2 - (gH * gp.ratio) / 2, top: Animated.add(height - roadH * 0.5 - gH, Animated.multiply(bob, -7)) }}>
            <PoseImage p={gp} width={gH * gp.ratio} height={gH} shadow={0} />
          </Animated.View>
        )}
        {isMetro && (
          <View pointerEvents="none" style={{ position: 'absolute', left: width / 2 - (gH * pose('phone').ratio) / 2, top: height * 0.5 }}>
            <Animated.View style={{ transform: [{ translateY: Animated.multiply(bob, -2) }] }}>
              <PoseImage p={pose('phone')} width={gH * pose('phone').ratio} height={gH} shadow={0.8} />
            </Animated.View>
          </View>
        )}

        {/* XP/коїни, що щойно зароблені, капають зверху */}
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
          {drips.map((d, i) => (
            <Drip key={i} kind={d.kind} amt={d.amt} x={d.x * width} delay={d.delay} height={height} />
          ))}
        </View>
        {(xpGain > 0 || coinGain > 0) && (
          <View pointerEvents="none" style={styles.gainBar}>
            {xpGain > 0 && <Text style={styles.gainTxt}>⭐ +{xpShown} XP</Text>}
            {coinGain > 0 && <Text style={styles.gainTxt}>🪙 +{coinShown}</Text>}
          </View>
        )}

        {/* куди їдемо */}
        <View pointerEvents="none" style={styles.dest}>
          <Text style={styles.kick}>У ДОРОЗІ · {TRAVEL_LABEL[mode].toUpperCase()}</Text>
          <LessonTitle text={to.loc.title} variant="pop" maxWidth={width - 40} />
          {actChanged && (
            <View style={styles.actBox}>
              <Text style={styles.actKick}>АКТ {act.n} · {act.title.toUpperCase()}</Text>
              <Text style={styles.actTxt}>{act.troll[(to.moduleNo + to.k) % act.troll.length]}</Text>
            </View>
          )}
        </View>
        <Text style={styles.skip}>тап: пропустити · {from.loc.title} → {to.loc.title}</Text>
      </Pressable>
    </Animated.View>
  );
}

// Тунель метро: вогні розбігаються від центру, колії сходяться, легка тряска
function Tunnel({ t, width, height }: { t: Animated.Value; width: number; height: number }) {
  const lamps = 9;
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([Animated.timing(shake, { toValue: 1, duration: 90, useNativeDriver: false }), Animated.timing(shake, { toValue: 0, duration: 90, useNativeDriver: false })]));
    l.start();
    return () => l.stop();
  }, [shake]);
  const cx = width / 2;
  const cy = height * 0.4;
  return (
    <Animated.View style={{ position: 'absolute', left: 0, top: 0, width, height, backgroundColor: '#07090f', transform: [{ translateY: Animated.multiply(shake, 1.5) }] }}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="tun" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#0d1220" />
            <Stop offset="0.5" stopColor="#161c30" />
            <Stop offset="1" stopColor="#0a0d16" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#tun)" />
      </Svg>
      {Array.from({ length: lamps }, (_, i) => (
        <Lamp key={i} t={t} i={i} n={lamps} cx={cx} cy={cy} width={width} height={height} />
      ))}
    </Animated.View>
  );
}

function Lamp({ t, i, n, cx, cy, width, height }: { t: Animated.Value; i: number; n: number; cx: number; cy: number; width: number; height: number }) {
  // кожна лампа проходить шлях від центру до краю за 1.2 с, зі зсувом по фазі
  const ph = Animated.modulo(Animated.add(Animated.multiply(t, 0.85), i / n), 1);
  const sc = ph.interpolate({ inputRange: [0, 1], outputRange: [0.05, 3.2] });
  const op = ph.interpolate({ inputRange: [0, 0.15, 0.85, 1], outputRange: [0, 1, 0.9, 0] });
  const side = i % 2 === 0 ? -1 : 1;
  return (
    <>
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: cx - 32, top: cy - 6, width: 64, height: 12, borderRadius: 6, backgroundColor: '#ffe29a', opacity: op, transform: [{ translateX: Animated.multiply(ph.interpolate({ inputRange: [0, 1], outputRange: [0, width * 0.55] }), side) }, { translateY: ph.interpolate({ inputRange: [0, 1], outputRange: [0, -height * 0.18] }) }, { scale: sc }] }} />
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: cx - width * 0.4, top: cy + 6, width: width * 0.8, height: 3, backgroundColor: 'rgba(255,255,255,0.2)', opacity: op, transform: [{ translateY: ph.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.55] }) }, { scaleX: sc }] }} />
    </>
  );
}

function Drip({ kind, amt, x, delay, height }: { kind: 'xp' | 'coin'; amt: number; x: number; delay: number; height: number }) {
  const y = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const id = setTimeout(() => Animated.timing(y, { toValue: 1, duration: 1250, easing: Easing.in(Easing.quad), useNativeDriver: false }).start(), delay);
    return () => clearTimeout(id);
  }, [y, delay]);
  return (
    <Animated.View
      style={[
        styles.drip,
        kind === 'coin' ? { backgroundColor: '#ffce4d' } : { backgroundColor: '#36e27a' },
        { left: Math.max(6, Math.min(x, 300)), opacity: y.interpolate({ inputRange: [0, 0.05, 0.8, 1], outputRange: [0, 1, 1, 0] }), transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [-40, height * 0.36] }) }, { rotate: kind === 'coin' ? '-6deg' : '5deg' }] },
      ]}
    >
      <Text style={styles.dripTxt}>
        {kind === 'coin' ? '🪙' : '⭐'} +{amt}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dest: { position: 'absolute', left: 18, right: 18, top: '14%' },
  kick: { alignSelf: 'flex-start', backgroundColor: '#36e27a', color: '#0d0f14', fontWeight: '900', fontSize: 11, letterSpacing: 1.6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', marginBottom: 8 },
  actBox: { marginTop: 14, backgroundColor: 'rgba(247,241,228,0.96)', borderRadius: 16, padding: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: '#d9ceb4', maxWidth: 340 },
  actKick: { color: '#1c8f4f', fontWeight: '900', fontSize: 11, letterSpacing: 1.4 },
  actTxt: { color: '#2a2418', fontWeight: '800', fontSize: 15, marginTop: 3 },
  gainBar: { position: 'absolute', top: 14, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 18 },
  gainTxt: { color: '#fff', fontWeight: '900', fontSize: 20, textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
  drip: { position: 'absolute', top: 0, paddingHorizontal: 11, paddingVertical: 5, borderRadius: 14, borderWidth: 2, borderColor: '#fff' },
  dripTxt: { color: '#0d0f14', fontWeight: '900', fontSize: 15 },
  skip: { position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700' },
});
