import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CharStart = 'caveman' | 'sapiens' | 'early';

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
  charName: string;
  charStart: CharStart;
  energy: number;
  coins: number;
  streak: number;
  level: number;
  completed: string[]; // ids пройдених уроків
  quiz: QuizAnswers;

  setHydrated: () => void;
  setQuizAnswer: (key: keyof QuizAnswers, value: string) => void;
  finishOnboarding: (name: string) => void;
  completeLesson: (id: string, coinsEarned: number) => void;
  spendEnergy: (n: number) => void;
  reset: () => void;
};

const MAX_ENERGY = 50;

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
      charName: 'Гріндік',
      charStart: 'caveman',
      energy: MAX_ENERGY,
      coins: 0,
      streak: 1,
      level: 1,
      completed: [],
      quiz: {},

      setHydrated: () => set({ hydrated: true }),

      setQuizAnswer: (key, value) =>
        set((s) => ({ quiz: { ...s.quiz, [key]: value } })),

      finishOnboarding: (name) =>
        set((s) => ({
          onboarded: true,
          charName: name.trim() || 'Гріндік',
          charStart: startFromExp(s.quiz.exp),
        })),

      completeLesson: (id, coinsEarned) =>
        set((s) => {
          const completed = s.completed.includes(id)
            ? s.completed
            : [...s.completed, id];
          const level = completed.length >= 5 ? 3 : completed.length >= 2 ? 2 : 1;
          return { completed, coins: s.coins + coinsEarned, level };
        }),

      spendEnergy: (n) =>
        set((s) => ({ energy: Math.max(0, s.energy - n) })),

      reset: () =>
        set({
          onboarded: false,
          charName: 'Гріндік',
          charStart: 'caveman',
          energy: MAX_ENERGY,
          coins: 0,
          streak: 1,
          level: 1,
          completed: [],
          quiz: {},
        }),
    }),
    {
      name: 'grindset-state',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

export const ENERGY_PER_LESSON = 10;
