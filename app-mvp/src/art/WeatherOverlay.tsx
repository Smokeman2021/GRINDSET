import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useStore } from '../store';
import { forecastUrl, grade, parseForecast, resolveScene, type SceneState, type SceneWeather } from './weatherLogic';

// ───────── Драйвер: реальна погода Києва (Open-Meteo) + час доби за годинником ─────────
// Запит один раз на 30 хв, лише координати міста (жодних персональних даних). Помилка мережі → ясно. Вимикається в Налаштуваннях.
const TTL = 30 * 60 * 1000;
let cache: { at: number; value: SceneWeather | null } | null = null;
let inflight: Promise<SceneWeather | null> | null = null;

async function realWeather(): Promise<SceneWeather | null> {
  if (cache && Date.now() - cache.at < TTL) return cache.value;
  inflight ??= (async () => {
    try {
      const res = await fetch(forecastUrl());
      const v = res.ok ? parseForecast(await res.json()) : null;
      cache = { at: Date.now(), value: v };
      return v;
    } catch {
      cache = { at: Date.now(), value: null };
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function useSceneState(): SceneState {
  const mode = useStore((s) => s.sceneMode);
  const [real, setReal] = useState<SceneWeather | null>(cache?.value ?? null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (mode !== 'auto') return;
    let alive = true;
    void realWeather().then((v) => alive && setReal(v));
    return () => {
      alive = false;
    };
  }, [mode]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 5 * 60 * 1000); // час доби оновлюється, якщо екран довго відкритий
    return () => clearInterval(t);
  }, []);
  return useMemo(() => resolveScene(mode, real, now), [mode, real, now]);
}

// ───────── Рендер: колір-корекція + частинки ─────────
export function WeatherOverlay({ state }: { state: SceneState }) {
  const g = grade(state);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {g && <View style={[StyleSheet.absoluteFill, { backgroundColor: g.tint, opacity: g.opacity }]} />}
      {state?.part === 'night' && <View style={[StyleSheet.absoluteFill, styles.vignette]} />}
      {state?.weather === 'fog' && <Fog />}
      {state?.weather === 'rain' && <Particles kind="rain" count={34} />}
      {state?.weather === 'snow' && <Particles kind="snow" count={30} />}
    </View>
  );
}

function Fog() {
  const t = useRef(new Animated.Value(0)).current;
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: 9000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [focused, t]);
  const { width } = useWindowDimensions();
  return (
    <>
      <Animated.View style={[styles.fogBand, { top: '30%', transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [-width * 0.12, width * 0.12] }) }] }]} />
      <Animated.View style={[styles.fogBand, { top: '58%', opacity: 0.8, transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [width * 0.1, -width * 0.1] }) }] }]} />
    </>
  );
}

// Дощ і сніг: кожна частинка має свою колонку, швидкість і фазу; один цикл Animated на частинку, зупиняється поза фокусом
function Particles({ kind, count }: { kind: 'rain' | 'snow'; count: number }) {
  const { width, height } = useWindowDimensions();
  const focused = useIsFocused();
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: ((i * 97) % 100) / 100,
        dur: kind === 'rain' ? 650 + ((i * 53) % 450) : 4200 + ((i * 131) % 3600),
        delay: (i * 211) % (kind === 'rain' ? 900 : 4000),
        size: kind === 'rain' ? 1 + (i % 2) : 3 + (i % 4),
        v: new Animated.Value(0),
      })),
    [count, kind]
  );
  useEffect(() => {
    if (!focused) return;
    const loops = parts.map((p) => {
      // затримка старту окремо від циклу: delay всередині loop-таймінгу на вебі зупиняв повтор після першого проходу
      const l = Animated.sequence([Animated.delay(p.delay), Animated.loop(Animated.sequence([Animated.timing(p.v, { toValue: 1, duration: p.dur, easing: Easing.linear, useNativeDriver: true }), Animated.timing(p.v, { toValue: 0, duration: 0, useNativeDriver: true })]))]);
      l.start();
      return l;
    });
    return () => loops.forEach((l) => l.stop());
  }, [parts, focused]);
  const fall = height + 40;
  return (
    <>
      {parts.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: p.x * width,
            top: -30,
            width: p.size,
            height: kind === 'rain' ? 16 + p.size * 6 : p.size,
            borderRadius: kind === 'rain' ? 1 : p.size,
            backgroundColor: kind === 'rain' ? 'rgba(200,215,235,0.55)' : 'rgba(255,255,255,0.85)',
            opacity: p.v.interpolate({ inputRange: [0, 0.05, 0.95, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, fall] }) },
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, kind === 'rain' ? -fall * 0.18 : (i % 2 ? 24 : -24)] }) },
              ...(kind === 'rain' ? [{ rotate: '12deg' }] : []),
            ],
          }}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  vignette: { borderWidth: 40, borderColor: 'rgba(0,0,0,0.22)', borderRadius: 0 },
  fogBand: { position: 'absolute', left: -60, right: -60, height: 140, backgroundColor: 'rgba(230,236,243,0.28)', borderRadius: 80 },
});
