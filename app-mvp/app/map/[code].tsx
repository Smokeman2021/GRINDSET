// Карта Києва гілки (ТЗ 004, етап E): кожна одиниця гілки — точка в закладі Києва. Гріндік стоїть на наступному завданні.
// Після уроку (?done=<id>) — смуга «Пройдено … · Відкрилось …». Малюнок карти — той самий, що в подорожі Києвом (src/art/JourneyMap.tsx).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { sceneKey, shouldShow, travelCaption, travelKey } from '../../src/data/branchScenes';
import { Travel } from '../../src/art/Travel';
import { branchStop, branchTravel } from '../../src/art/branchStop';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PoseImage } from '../../src/components/PoseImage';
import { FeedbackSheet } from '../../src/components/FeedbackSheet';
import { Button } from '../../src/components/Button';
import { CLOUD_MODE } from '../../src/cloud/config';
import { pose } from '../../src/data/poses';
import { art } from '../../src/art';
import { LOCS } from '../../src/art/levels';
import { getBranch, readyLessonIds, unitById } from '../../src/data/branches';
import { branchPins, newlyOpened, type MapPin } from '../../src/data/branchMap';
import { ENERGY_PER_LESSON, useStore } from '../../src/store';

// Позиції 7 точок (частки полотна): від околиці внизу до центру вгорі
const PINS = [
  { x: 0.22, y: 0.9 },
  { x: 0.52, y: 0.8 },
  { x: 0.76, y: 0.68 },
  { x: 0.5, y: 0.56 },
  { x: 0.24, y: 0.44 },
  { x: 0.46, y: 0.3 },
  { x: 0.66, y: 0.14 },
];
const DISTRICTS = [
  { t: 'ОКОЛИЦЯ', x: 0.06, y: 0.97 },
  { t: 'ПОДІЛ', x: 0.42, y: 0.72 },
  { t: 'ХРЕЩАТИК', x: 0.3, y: 0.52 },
  { t: 'ЛІВИЙ БЕРЕГ', x: 0.78, y: 0.5 },
  { t: 'ПЕЧЕРСЬК', x: 0.5, y: 0.05 },
];
const LAND = '#ece4d1';
const BLOCK = '#e0d6bf';
const PARK = '#bfdc9f';

function smooth(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    d += ` C${(p1.x + (p2.x - p0.x) / 6).toFixed(1)} ${(p1.y + (p2.y - p0.y) / 6).toFixed(1)} ${(p2.x - (p3.x - p1.x) / 6).toFixed(1)} ${(p2.y - (p3.y - p1.y) / 6).toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

const KIND_LABEL: Record<MapPin['kind'], string> = { lesson: 'УРОК', practice: 'ПРАКТИКА', final: 'ФІНАЛ' };

export default function BranchMap() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: winW, height: winH } = useWindowDimensions();
  const { code, done } = useLocalSearchParams<{ code: string; done?: string }>();
  const b = getBranch(String(code ?? '').toUpperCase());
  const completed = useStore((s) => s.completed);
  const prog = useStore((s) => (b ? s.branchProg[b.code] : undefined));
  const energy = useStore((s) => s.energy);
  const strictEnergy = useStore((s) => s.strictEnergy);
  const simStep = useStore((s) => s.simLeads?.step ?? 0);
  const seenScenes = useStore((s) => s.seenScenes);
  const [sel, setSel] = useState<string | null>(null);
  // переїзд після одиниці (ТЗ 006, 3.1): перший раз — дорога до наступного закладу з підписом «Освоєно · Відкрилось»; повторно — одразу карта
  const [travelOn, setTravelOn] = useState(() => !!done && shouldShow(useStore.getState().seenScenes, travelKey(String(done))));
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const scroll = useRef<ScrollView>(null);
  const bob = useRef(new Animated.Value(0)).current;

  const W = Math.min(winW, 560);
  const ready = b ? readyLessonIds(b) : [];
  const pins = useMemo(() => (b ? branchPins(b.code, completed, prog, ready, !!b.final?.ready) : []), [b, completed, prog]); // eslint-disable-line react-hooks/exhaustive-deps
  const positions = useMemo(() => pins.length <= PINS.length ? PINS : pins.map((_, i) => ({
    x: [0.22, 0.52, 0.75, 0.49][i % 4],
    y: 0.93 - 0.82 * i / (pins.length - 1),
  })), [pins.length]);
  const H = Math.round(W * (positions.length > PINS.length ? Math.max(2.65, pins.length * 0.19) : 1.7));
  // що відкрилось після щойно пройденої одиниці
  const opened = useMemo(() => {
    if (!b || !done) return [];
    const before = branchPins(b.code, completed.filter((id) => id !== done), prog, ready, !!b.final?.ready);
    return newlyOpened(before, pins);
  }, [b, done, pins]); // eslint-disable-line react-hooks/exhaustive-deps
  const nextPin = pins.find((p) => p.state === 'next');
  const hereIdx = Math.max(0, pins.findIndex((p) => p.state === 'next'));

  useEffect(() => {
    const l = Animated.loop(Animated.sequence([Animated.timing(bob, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: false }), Animated.timing(bob, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.sin), useNativeDriver: false })]));
    l.start();
    return () => l.stop();
  }, [bob]);
  useEffect(() => {
    const y = positions[hereIdx].y * H - winH / 2 + 120;
    const t = setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, y), animated: false }), 30);
    return () => clearTimeout(t);
  }, [hereIdx, H, winH, positions]);

  if (!b) {
    return (
      <View style={[styles.root, { padding: 20, paddingTop: insets.top + 20 }]}>
        <Text style={styles.sheetTitle}>Гілку не знайдено</Text>
        <Button title="До вертикалей" onPress={() => router.dismissTo('/home')} />
      </View>
    );
  }

  const hub = `/branch/${b.code}` as const;
  const titleOf = (id: string) => unitById(id)?.unit.title ?? id;
  const open = (id: string) => {
    const freePractice = b.code.endsWith('-A1') && id.endsWith('-PR');
    if (strictEnergy && energy < ENERGY_PER_LESSON && !completed.includes(id) && !freePractice) return router.navigate('/shop');
    useStore.getState().setBranchProg(b.code, { started: true });
    if (b.code !== 'STA-A1' && shouldShow(useStore.getState().seenScenes, sceneKey(id))) return router.push({ pathname: '/scene/[id]', params: { id } });
    if (id === b.final?.id && b.final.sim === 'leads') return router.push('/leads');
    router.push(`/lesson/${id}`);
  };
  const pts = positions.slice(0, pins.length).map((p) => ({ x: p.x * W, y: p.y * H }));
  // пройдена частина маршруту: суцільний префікс пройдених точок (не тягнемо зелене через непройдені)
  const firstNotDone = pins.findIndex((p) => p.state !== 'done');
  const doneUpto = firstNotDone < 0 ? pins.length : firstNotDone;
  const selPin = pins.find((p) => p.id === sel);
  const sp = pose('wave');

  return (
    <View style={styles.root}>
      <ScrollView ref={scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ width: winW, alignItems: 'center', paddingTop: insets.top + 110, paddingBottom: 220 }}>
        <View style={{ width: W, height: H }}>
          <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="river" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#8cc3e8" />
                <Stop offset="1" stopColor="#a9d8f2" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={W} height={H} fill={LAND} />
            {Array.from({ length: 56 }, (_, i) => {
              const gx = (i % 7) / 7;
              const gy = Math.floor(i / 7) / 8;
              const jx = ((i * 37) % 11) / 90;
              const jy = ((i * 53) % 13) / 140;
              return <Rect key={i} x={(gx + jx) * W + 4} y={(gy + jy) * H + 4} width={W / 7 - 18 - ((i * 13) % 10)} height={H / 8 - 22 - ((i * 7) % 12)} rx={6} fill={BLOCK} />;
            })}
            {[[0.14, 0.66, 40], [0.42, 0.24, 44], [0.8, 0.88, 36], [0.66, 0.5, 30]].map(([x, y, r], i) => (
              <Circle key={i} cx={x * W} cy={y * H} r={r} fill={PARK} opacity={0.85} />
            ))}
            <Path d={`M${0.6 * W} ${-0.02 * H} C${0.7 * W} ${0.12 * H} ${0.8 * W} ${0.18 * H} ${0.86 * W} ${0.32 * H} S${0.94 * W} ${0.55 * H} ${0.9 * W} ${0.7 * H} S${0.99 * W} ${0.9 * H} ${0.96 * W} ${1.02 * H}`} stroke="url(#river)" strokeWidth={W * 0.14} fill="none" strokeLinecap="round" />
            {DISTRICTS.map((d) => (
              <SvgText key={d.t} x={d.x * W} y={d.y * H} fontSize={11} fontWeight="800" letterSpacing={2.4} fill="#9a8f76" opacity={0.7}>
                {d.t}
              </SvgText>
            ))}
            <Path d={smooth(pts)} stroke="#fff" strokeWidth={13} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <Path d={smooth(pts)} stroke="#b7ad95" strokeWidth={5} fill="none" strokeLinecap="round" strokeDasharray="1 11" />
            {doneUpto > 1 && <Path d={smooth(pts.slice(0, doneUpto))} stroke="#36e27a" strokeWidth={8} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
          </Svg>

          {pins.map((p, i) => {
            const pos = positions[i];
            const locked = p.state === 'locked';
            const fresh = opened.some((o) => o.id === p.id);
            const color = p.state === 'done' ? '#36e27a' : p.state === 'next' ? '#ffc93c' : locked ? '#b4ab94' : '#7fb3ff';
            return (
              <Pressable key={p.id} onPress={() => setSel(sel === p.id ? null : p.id)} style={{ position: 'absolute', left: pos.x * W - 26, top: pos.y * H - 62, width: 52, alignItems: 'center', opacity: locked ? 0.75 : 1 }} accessibilityRole="button" accessibilityLabel={`${KIND_LABEL[p.kind]} ${titleOf(p.id)}`}>
                {p.state === 'next' && (
                  <Animated.View style={{ position: 'absolute', top: -70, transform: [{ translateY: Animated.multiply(bob, -5) }] }}>
                    <PoseImage p={sp} height={66} shadow={0} />
                  </Animated.View>
                )}
                <Svg width={52} height={62} viewBox="0 0 52 62">
                  <Path d="M26 60 C26 60 6 38 6 24 A20 20 0 0 1 46 24 C46 38 26 60 26 60 Z" fill="rgba(0,0,0,0.2)" transform="translate(2 3)" />
                  <Path d="M26 60 C26 60 6 38 6 24 A20 20 0 0 1 46 24 C46 38 26 60 26 60 Z" fill={color} stroke={sel === p.id ? '#1b1b1b' : '#fff'} strokeWidth={3} />
                  <Circle cx={26} cy={24} r={12} fill={locked ? '#d8d0bc' : '#fff'} />
                </Svg>
                <Text style={styles.pinNum}>{locked ? '🔒' : p.state === 'done' ? '✓' : p.kind === 'final' ? '🏁' : p.kind === 'practice' ? '🎯' : p.n}</Text>
                <View style={[styles.pinLabel, fresh && { borderColor: '#ffc93c', borderWidth: 2 }]}>
                  <Text style={styles.pinLabelTxt} numberOfLines={1}>
                    {LOCS[p.locId]?.title ?? p.locId}
                  </Text>
                  <Text style={styles.pinSub} numberOfLines={1}>
                    {fresh ? 'НОВЕ · ' : ''}
                    {KIND_LABEL[p.kind]}
                    {p.kind === 'lesson' ? ` ${p.n}` : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* шапка */}
      <View style={[styles.top, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.dismissTo(hub)} style={styles.backPill} accessibilityRole="button" accessibilityLabel="До гілки">
          <Text style={styles.back}>◀ {b.emoji} {b.title}</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        {CLOUD_MODE !== 'off' && (
          <Pressable onPress={() => setFeedbackOpen(true)} hitSlop={8} accessibilityLabel="Відгук">
            <Text style={{ fontSize: 20 }}>🐞</Text>
          </Pressable>
        )}
      </View>
      <View pointerEvents="none" style={[styles.title, { top: insets.top + 50 }]}>
        <Text style={styles.titleTxt}>КИЇВ</Text>
        <Text style={styles.titleSub}>{b.title}: кожне завдання — заклад на карті. Гріндік стоїть на наступному.</Text>
      </View>

      {/* після уроку: що пройдено й що відкрилось */}
      {done && !sel && (
        <View style={styles.sheet}>
          <Text style={styles.sheetKick}>ПРОЙДЕНО</Text>
          <Text style={styles.sheetTitle} numberOfLines={2}>
            {titleOf(done)}
          </Text>
          {opened.length > 0 && <Text style={styles.sheetTxt}>Відкрилось: {opened.map((o) => titleOf(o.id)).join(', ')}</Text>}
          {nextPin ? <Text style={styles.sheetTxt}>Далі: {titleOf(nextPin.id)} · {LOCS[nextPin.locId]?.title}</Text> : <Text style={styles.sheetTxt}>Гілку пройдено. Повторити можна будь-яку точку.</Text>}
          <View style={{ height: 8 }} />
          {nextPin ? <Button title="Їхати далі" onPress={() => open(nextPin.id)} /> : <Button title="До гілки" onPress={() => router.dismissTo(hub)} />}
        </View>
      )}

      {/* вибрана точка */}
      {selPin && (
        <View style={styles.sheet}>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            {LOCS[selPin.locId] && <Image source={art(LOCS[selPin.locId].plate).src} style={styles.thumb} resizeMode="cover" />}
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetKick}>
                {KIND_LABEL[selPin.kind]}
                {selPin.kind === 'lesson' ? ` ${selPin.n}` : ''} · {(LOCS[selPin.locId]?.title ?? '').toUpperCase()}
              </Text>
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {titleOf(selPin.id)}
              </Text>
            </View>
            <Pressable onPress={() => setSel(null)} hitSlop={10}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          {selPin.state === 'locked' ? (
            <Text style={styles.sheetTxt}>🔒 {selPin.why}</Text>
          ) : (
            <>
              <View style={{ height: 8 }} />
              <Button
                title={selPin.state === 'done' ? 'Повторити (без нагороди)' : selPin.kind === 'final' && b.final?.sim && simStep > 0 ? `Продовжити з кроку ${simStep + 1}` : selPin.state === 'next' ? 'Їхати сюди' : 'Відкрити'}
                onPress={() => open(selPin.id)}
              />
              {/* повторний перегляд сцени закладу (ТЗ 007, п. 4): перший раз вона відкривається сама, далі — за бажанням */}
              {!shouldShow(seenScenes, sceneKey(selPin.id)) && (
                <Pressable onPress={() => router.push({ pathname: '/scene/[id]', params: { id: selPin.id } })} style={styles.sceneAgain} accessibilityRole="button">
                  <Text style={styles.sceneAgainTxt}>🎬 Переглянути сцену закладу</Text>
                </Pressable>
              )}
            </>
          )}
        </View>
      )}
      <FeedbackSheet visible={feedbackOpen} onClose={() => setFeedbackOpen(false)} context={{ screen: `map/${b.code}` }} />
      {travelOn && done && (() => {
        const from = branchStop(b.code, String(done), titleOf(String(done)));
        const toId = nextPin?.id ?? String(done);
        const to = branchStop(b.code, toId, titleOf(toId));
        if (!from || !to) return null;
        const t = branchTravel(from, to);
        const cap = travelCaption(titleOf(String(done)), opened.map((o) => titleOf(o.id)), nextPin ? titleOf(nextPin.id) : null);
        const end = () => {
          useStore.getState().markSeen(travelKey(String(done)));
          setTravelOn(false);
        };
        return (
          <View style={StyleSheet.absoluteFill}>
            <Travel from={from} to={to} mode={t.mode} act={t.act} actChanged={t.actChanged} xpGain={0} coinGain={0} onDone={end} caption={cap} />
          </View>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: LAND },
  top: { position: 'absolute', left: 12, right: 12, top: 0, flexDirection: 'row', alignItems: 'center' },
  backPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 34, borderRadius: 17, backgroundColor: 'rgba(13,15,20,0.75)', borderWidth: 1, borderColor: '#36e27a' },
  back: { color: '#eef2f7', fontWeight: '900', fontSize: 13 },
  title: { position: 'absolute', left: 8, right: 8, backgroundColor: 'rgba(236,228,209,0.88)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  titleTxt: { color: '#2a2418', fontWeight: '900', fontSize: 30, letterSpacing: 3, textShadowColor: '#fff', textShadowRadius: 6 },
  titleSub: { color: '#6b604a', fontWeight: '700', fontSize: 12, textShadowColor: '#fff', textShadowRadius: 4 },
  pinNum: { position: 'absolute', top: 13, fontWeight: '900', fontSize: 15, color: '#1c8f4f' },
  pinLabel: { marginTop: -2, backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, alignItems: 'center', minWidth: 80, borderWidth: 1, borderColor: '#d9ceb4' },
  pinLabelTxt: { color: '#2a2418', fontWeight: '800', fontSize: 11, maxWidth: 150 },
  pinSub: { color: '#6b604a', fontWeight: '700', fontSize: 9 },
  sheet: { position: 'absolute', left: 12, right: 12, bottom: 12, backgroundColor: 'rgba(247,241,228,0.98)', borderRadius: 20, borderWidth: 2, borderBottomWidth: 5, borderColor: '#d9ceb4', padding: 12 },
  sheetKick: { color: '#1c8f4f', fontWeight: '900', fontSize: 10, letterSpacing: 1.3 },
  sheetTitle: { color: '#2a2418', fontWeight: '900', fontSize: 16 },
  sheetTxt: { color: '#4a4232', fontSize: 13, marginTop: 6, fontWeight: '600' },
  sceneAgain: { alignSelf: 'center', marginTop: 10, paddingVertical: 6 },
  sceneAgainTxt: { color: '#2b6cb0', fontSize: 13, fontWeight: '800' },
  thumb: { width: 64, height: 44, borderRadius: 8 },
  close: { color: '#6b604a', fontWeight: '900', fontSize: 16, paddingHorizontal: 4 },
});
