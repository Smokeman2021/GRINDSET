// Джерело нахилу для паралакса: Animated.ValueXY зі значеннями в діапазоні -1..1.
//  - Telegram Mini App: Telegram.WebApp.DeviceOrientation (Bot API 8.0+), там гіроскоп не просить дозволу в браузері;
//  - браузер на телефоні: DeviceOrientationEvent (на iOS потрібен дозвіл від жесту: requestTilt());
//  - десктоп: рух миші;
//  - усе інше (нативний застосунок без сенсорного пакета): повільний ambient-дрейф, щоб сцена не була мертвою.
// Один спільний ValueXY на всю програму: підписки лічаться, сенсор вмикається лише поки є глядачі.
import { useEffect } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { tgWebApp } from '../telegram/webapp';

const tilt = new Animated.ValueXY({ x: 0, y: 0 });
let viewers = 0;
let stop: (() => void) | null = null;
let permissionNeeded = false;
let permissionGranted = false;

const clamp = (v: number) => Math.max(-1, Math.min(1, v));

function startSensors(): () => void {
  const offs: (() => void)[] = [];
  const tg = tgWebApp();

  // 1) Telegram DeviceOrientation (рад.): beta ±π/2 вперед/назад, gamma ±π/2 вліво/вправо
  const tgOrient = (tg as unknown as { DeviceOrientation?: { start: (p?: object) => void; stop: () => void; beta: number; gamma: number } } | null)?.DeviceOrientation;
  if (tgOrient) {
    try {
      tgOrient.start({ refresh_rate: 60 });
      const onChange = () => {
        tilt.setValue({ x: clamp(tgOrient.gamma / 0.6), y: clamp((tgOrient.beta - 0.9) / 0.6) });
      };
      tg!.onEvent('deviceOrientationChanged', onChange);
      offs.push(() => {
        tg!.offEvent('deviceOrientationChanged', onChange);
        tgOrient.stop();
      });
      return () => offs.forEach((f) => f());
    } catch {
      // нижче звичайний браузерний варіант
    }
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // 2) гіроскоп браузера
    const w = window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } };
    permissionNeeded = typeof w.DeviceOrientationEvent?.requestPermission === 'function';
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      permissionGranted = true;
      tilt.setValue({ x: clamp(e.gamma / 28), y: clamp((e.beta - 50) / 28) });
    };
    if (!permissionNeeded || permissionGranted) window.addEventListener('deviceorientation', onOrient);
    offs.push(() => window.removeEventListener('deviceorientation', onOrient));
    // 3) миша на десктопі
    const onMouse = (e: MouseEvent) => {
      if (permissionGranted) return;
      tilt.setValue({ x: clamp((e.clientX / window.innerWidth - 0.5) * 2), y: clamp((e.clientY / window.innerHeight - 0.5) * 2) });
    };
    window.addEventListener('mousemove', onMouse);
    offs.push(() => window.removeEventListener('mousemove', onMouse));
  }

  // 4) ambient-дрейф, коли немає реального джерела (на нативі зараз завжди; у вебі на дотик-пристроях до дозволу)
  const drift = Animated.loop(
    Animated.sequence([
      Animated.timing(tilt, { toValue: { x: 0.5, y: 0.2 }, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      Animated.timing(tilt, { toValue: { x: -0.5, y: -0.2 }, duration: 5200, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
    ])
  );
  if (Platform.OS !== 'web') drift.start();
  offs.push(() => drift.stop());
  return () => offs.forEach((f) => f());
}

// Запит дозволу на гіроскоп (iOS Safari): викликати з обробника дотику. Повертає true, якщо дозволено або дозвіл не потрібен.
export async function requestTilt(): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const D = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
  if (!D?.requestPermission) return true;
  try {
    const res = await D.requestPermission();
    permissionGranted = res === 'granted';
    if (permissionGranted && viewers > 0) {
      stop?.();
      stop = startSensors();
    }
    return permissionGranted;
  } catch {
    return false;
  }
}

export const tiltNeedsPermission = () => permissionNeeded && !permissionGranted;

// Хук: підписує сцену на нахил і повертає спільний Animated.ValueXY (-1..1)
export function useTilt(enabled = true): Animated.ValueXY {
  useEffect(() => {
    if (!enabled) return;
    viewers++;
    if (viewers === 1) stop = startSensors();
    return () => {
      viewers--;
      if (viewers === 0) {
        stop?.();
        stop = null;
        tilt.setValue({ x: 0, y: 0 });
      }
    };
  }, [enabled]);
  return tilt;
}
