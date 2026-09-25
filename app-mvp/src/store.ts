import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CharStart = 'caveman' | 'sapiens' | 'early';
export type DailyGoal = 'casual' | 'regular' | 'intense';

type QuizAnswers = {
  goal?: string;
  exp?: string;
  budget?: string;
  time?: string;
  mode?: string;
};

type State = {
  hydrated: boolean;
  onboarded: boolean;
  playerName: string;
  playerPhoto: string | null; // фото гравця (uri / data-uri); поки null — плейсхолдер з ініціалом
  charStart: CharStart;
  energy: number;
  coins: number;
  xp: number;
  xpToday: number;
  streak: number;
  streakFreezes: number;
  lastActiveDate: string | null; // YYYY-MM-DD, local
  daysAway: number; // скільки днів гравця не було на момент останнього входу (для реплік Гріндіка)
  dailyGoal: DailyGoal;
  level: number;
  completed: string[]; // ids пройдених уроків (включно з 'checkpoint')
  quiz: QuizAnswers;

  setHydrated: () => void;
  setQuizAnswer: (key: keyof QuizAnswers, value: string) => void;
  finishOnboarding: (name: string, goal: DailyGoal) => void;
  setPlayerName: (name: string) => void;
  setPlayerPhoto: (uri: string | null) => void;
  checkStreak: () => void;
  completeLesson: (id: string, coinsEarned: number, xpEarned: number) => void;
  spendEnergy: (n: number) => void;
  buyStreakFreeze: () => void;
  reset: () => void;
};

const MAX_ENERGY = 50;
export const ENERGY_PER_LESSON = 10;

export const GOAL_XP: Record<DailyGoal, number> = {
  casual: 10,
  regular: 20,
  intense: 30,
};

export const GOAL_LABEL: Record<DailyGoal, string> = {
  casual: 'Спокійно',
  regular: 'Стандарт',
  intense: 'Жорстко',
};

export const STREAK_FREEZE_COST = 150;
export const MAX_STREAK_FREEZES = 2;

// Пороги XP для рівня (кумулятивно). Рівень = найвищий поріг, який досягнуто.
const LEVEL_THRESHOLDS = [0, 40, 90, 150, 220, 300, 400, 520, 660, 820];

function levelForXp(xp: number): number {
  let lvl = 1;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) lvl = i + 1;
    else break;
  }
  return lvl;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

function startFromExp(exp?: string): CharStart {
  if (!exp) return 'caveman';
  if (exp.includes('Чув')) return 'sapiens';
  if (exp.includes('Запускав') || exp.includes('працюю')) return 'early';
  return 'caveman';
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      onboarded: false,
      playerName: '',
      playerPhoto: null,
      charStart: 'caveman',
      energy: MAX_ENERGY,
      coins: 0,
      xp: 0,
      xpToday: 0,
      streak: 1,
      streakFreezes: 0,
      lastActiveDate: null,
      daysAway: 0,
      dailyGoal: 'regular',
      level: 1,
      completed: [],
      quiz: {},

      setHydrated: () => set({ hydrated: true }),

      setQuizAnswer: (key, value) =>
        set((s) => ({ quiz: { ...s.quiz, [key]: value } })),

      finishOnboarding: (name, goal) =>
        set((s) => ({
          onboarded: true,
          playerName: name.trim() || 'Гравець',
          charStart: startFromExp(s.quiz.exp),
          dailyGoal: goal,
          lastActiveDate: todayStr(),
        })),

      setPlayerName: (name) => set({ playerName: name.trim().slice(0, 14) }),

      setPlayerPhoto: (uri) => set({ playerPhoto: uri }),

      checkStreak: () =>
        set((s) => {
          const today = todayStr();
          if (!s.lastActiveDate) return { lastActiveDate: today };
          if (s.lastActiveDate === today) return s.daysAway ? { daysAway: 0 } : {};

          const gap = daysBetween(s.lastActiveDate, today);
          const away = { daysAway: gap };
          if (gap === 1) {
            return { ...away, streak: s.streak + 1, lastActiveDate: today, xpToday: 0 };
          }
          if (gap === 2 && s.streakFreezes > 0) {
            return {
              ...away,
              streak: s.streak + 1,
              lastActiveDate: today,
              xpToday: 0,
              streakFreezes: s.streakFreezes - 1,
            };
          }
          if (gap > 1) {
            return { ...away, streak: 1, lastActiveDate: today, xpToday: 0 };
          }
          return { lastActiveDate: today, xpToday: 0 };
        }),

      completeLesson: (id, coinsEarned, xpEarned) =>
        set((s) => {
          const completed = s.completed.includes(id)
            ? s.completed
            : [...s.completed, id];
          const xp = s.xp + xpEarned;
          return {
            completed,
            coins: s.coins + coinsEarned,
            xp,
            level: levelForXp(xp),
            xpToday: s.xpToday + xpEarned,
          };
        }),

      spendEnergy: (n) =>
        set((s) => ({ energy: Math.max(0, s.energy - n) })),

      buyStreakFreeze: () =>
        set((s) => {
          if (s.coins < STREAK_FREEZE_COST || s.streakFreezes >= MAX_STREAK_FREEZES) return {};
          return { coins: s.coins - STREAK_FREEZE_COST, streakFreezes: s.streakFreezes + 1 };
        }),

      reset: () =>
        set({
          onboarded: false,
          playerName: '',
          playerPhoto: null,
          charStart: 'caveman',
          energy: MAX_ENERGY,
          coins: 0,
          xp: 0,
          xpToday: 0,
          streak: 1,
          streakFreezes: 0,
          lastActiveDate: null,
          daysAway: 0,
          dailyGoal: 'regular',
          level: 1,
          completed: [],
          quiz: {},
        }),
    }),
    {
      name: 'grindset-state',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.checkStreak();
        state?.setHydrated();
      },
    }
  )
);
