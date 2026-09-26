// Локальні нагадування: зранку, ввечері і одне «X2» посеред дня з вікном 10 хвилин.
// Працює в Expo Go на Android/iOS як локальні (не push із сервера). На вебі вимкнено.
import { Platform } from 'react-native';
import { pickPush } from './data/pushTexts';

export const BOOST_MINUTES = 10;

export type NotifPrefs = { enabled: boolean; morning: string; evening: string }; // час у форматі HH:MM

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const dateStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Час «X2»-вікна на конкретну добу: детермінований, між 12:30 і 16:30
export function boostStart(day: Date): Date {
  const mins = 12 * 60 + 30 + (hash(dateStr(day)) % 241); // 12:30..16:30
  const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0, 0);
  d.setMinutes(mins);
  return d;
}

// Чи зараз активне «X2»; повертає скільки мс лишилось
export function boostLeftMs(now = new Date()): number {
  const start = boostStart(now).getTime();
  const end = start + BOOST_MINUTES * 60000;
  const t = now.getTime();
  return t >= start && t < end ? end - t : 0;
}

const parse = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map((x) => parseInt(x, 10));
  return { h: Number.isFinite(h) ? h : 8, m: Number.isFinite(m) ? m : 0 };
};

// Плануємо наступні 7 діб: щоразу скасовуємо старе й ставимо нове
export async function scheduleAll(prefs: NotifPrefs, streak: number, name: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const N = await import('expo-notifications');
    await N.cancelAllScheduledNotificationsAsync();
    if (!prefs.enabled) return;
    const perm = await N.getPermissionsAsync();
    if (!perm.granted) return;
    const now = Date.now();
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const day = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      const seed = hash(dateStr(day));
      const slots: { kind: 'morning' | 'evening' | 'boost'; at: Date }[] = [];
      const m = parse(prefs.morning);
      const e = parse(prefs.evening);
      slots.push({ kind: 'morning', at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), m.h, m.m) });
      slots.push({ kind: 'boost', at: boostStart(day) });
      slots.push({ kind: 'evening', at: new Date(day.getFullYear(), day.getMonth(), day.getDate(), e.h, e.m) });
      for (const s of slots) {
        if (s.at.getTime() <= now) continue;
        const text = pickPush(s.kind, seed + s.kind.length, streak, name);
        await N.scheduleNotificationAsync({
          content: { title: text.title, body: text.body, data: { kind: s.kind } },
          trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: s.at },
        });
      }
    }
  } catch (e) {
    console.warn('Сповіщення недоступні', e);
  }
}

export async function askPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const N = await import('expo-notifications');
    const cur = await N.getPermissionsAsync();
    if (cur.granted) return true;
    const res = await N.requestPermissionsAsync();
    return res.granted;
  } catch {
    return false;
  }
}
