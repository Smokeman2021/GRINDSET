import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ACHIEVEMENTS, Stats } from './data/achievements';
import { levelForXp } from './data/levels';
import { ITEMS } from './data/shop';
import { Metric, questsForDay } from './data/quests';
import { reviewed, srsKey, SrsMap } from './data/srs';
import type { Campaign, Entry } from './data/advice';
import { outcomeFor, rankOf, standings, weekStartStr, LeagueOutcome } from './data/league';

export type CharStart = 'caveman' | 'sapiens' | 'early';
export type DailyGoal = 'casual' | 'regular' | 'intense';

type QuizAnswers = {
  goal?: string;
  exp?: string;
  budget?: string;
  time?: string;
  mode?: string;
};

export type HistoryItem = { id: string; date: string; correct: number; errors: number; xp: number; coins: number };
export type MistakeRef = { lessonId: string; idx: number };
export type AnswerResult = MistakeRef & { ok: boolean };
export type LastWeek = { tier: number; rank: number; outcome: LeagueOutcome; weekId: string };

type State = {
  hydrated: boolean;
  onboarded: boolean;
  playerName: string;
  playerPhoto: string | null; // фото гравця (uri / data-uri); поки null — плейсхолдер з ініціалом
  charStart: CharStart;
  energy: number;
  energyAt: number; // мс: від якого моменту рахуємо відновлення енергії
  lastBonusDate: string | null; // дата останнього щоденного бонусу енергії
  strictEnergy: boolean; // true: без енергії нові уроки закриті
  notifEnabled: boolean; // нагадування (зранку, ввечері, X2 посеред дня)
  notifMorning: string;
  notifEvening: string;
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

  // бустери з магазину
  comboShields: number;
  hints: number;
  doubleCoins: number;
  frames: string[]; // куплені рамки аватара (крім класичної)
  frame: string;

  // статистика
  totalCorrect: number;
  totalErrors: number;
  perfectLessons: number;
  totalCoinsEarned: number;
  purchases: number;
  mistakesFixed: number;
  goldenGlasses: boolean;
  diagnosticDone: boolean;
  history: HistoryItem[];
  mistakes: MistakeRef[];
  unlocked: string[]; // відкриті досягнення

  // «Мої цифри»: трекер власних кампаній
  campaigns: Campaign[];

  // розумні повтори
  srs: SrsMap;

  // симулятор кампанії
  simDate: string;
  simRuns: number;

  // щоденні завдання
  questsDate: string;
  questProgress: Partial<Record<Metric, number>>;
  questsClaimed: string[];

  // ліга
  weekId: string;
  weekXp: number;
  tier: number;
  lastWeek: LastWeek | null;

  setHydrated: () => void;
  setQuizAnswer: (key: keyof QuizAnswers, value: string) => void;
  finishOnboarding: (name: string, goal: DailyGoal) => void;
  setPlayerName: (name: string) => void;
  setPlayerPhoto: (uri: string | null) => void;
  setDailyGoal: (goal: DailyGoal) => void;
  setStrictEnergy: (v: boolean) => void;
  setNotif: (p: Partial<{ notifEnabled: boolean; notifMorning: string; notifEvening: string }>) => void;
  checkStreak: () => void;
  refreshEnergy: () => void;
  completeLesson: (
    id: string,
    coinsEarned: number,
    xpEarned: number,
    extra?: { correct: number; errors: number; doubled?: boolean; practiceOnly?: boolean; maxCombo?: number; isQuiz?: boolean }
  ) => void;
  recordAnswers: (results: AnswerResult[]) => void;
  claimQuest: (id: string) => void;
  finishSim: (stars: number) => { coins: number; xp: number };
  addCampaign: (c: Omit<Campaign, 'id' | 'entries' | 'changes' | 'status' | 'startDate'>) => string;
  updateCampaign: (id: string, patch: Partial<Campaign>) => void;
  removeCampaign: (id: string) => void;
  saveEntry: (id: string, entry: Entry) => void;
  addChange: (id: string, text: string) => void;
  spendEnergy: (n: number) => void;
  useComboShield: () => boolean;
  useHint: () => boolean;
  buyItem: (id: string) => 'ok' | 'poor' | 'max' | 'owned';
  equipFrame: (frame: string) => void;
  finishDiagnostic: (perfect: boolean, skipTo: string[]) => void;
  reset: () => void;
};

export const MAX_ENERGY = 50;
export const ENERGY_PER_LESSON = 10;
export const ENERGY_REGEN_MS = 4 * 3600 * 1000; // +10 кожні 4 години
export const ENERGY_REGEN_AMOUNT = 10;
export const DAILY_ENERGY_BONUS = 10;

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

const isCrownId = (id: string) => id.startsWith('checkpoint');
const isQuizLessonId = (id: string) => /q\d+$/.test(id);

export function statsOf(s: State): Stats {
  const real = s.completed;
  return {
    lessons: real.filter((id) => !isCrownId(id) && !isQuizLessonId(id)).length,
    streak: s.streak,
    level: s.level,
    perfectLessons: s.perfectLessons,
    totalCoinsEarned: s.totalCoinsEarned,
    purchases: s.purchases,
    mistakesFixed: s.mistakesFixed,
    goldenGlasses: s.goldenGlasses,
    crowns: real.filter(isCrownId).length,
    quizzes: real.filter(isQuizLessonId).length,
  };
}

function withAchievements(s: State, patch: Partial<State>): Partial<State> {
  const merged = { ...s, ...patch } as State;
  const st = statsOf(merged);
  const now = ACHIEVEMENTS.filter((a) => a.test(st)).map((a) => a.id);
  const fresh = now.filter((id) => !s.unlocked.includes(id));
  return fresh.length ? { ...patch, unlocked: [...s.unlocked, ...fresh] } : patch;
}

// Якщо почався новий тиждень: підбиваємо підсумки минулого і оновлюємо лігу
function rolloverWeek(s: State): Partial<State> {
  const cur = weekStartStr();
  if (s.weekId === cur) return {};
  if (!s.weekId) return { weekId: cur, weekXp: 0 };
  const list = standings(s.weekId, s.tier, s.playerName, s.weekXp, 1);
  const rank = rankOf(list);
  const outcome = outcomeFor(rank, s.tier);
  const tier = outcome === 'up' ? s.tier + 1 : outcome === 'down' ? s.tier - 1 : s.tier;
  return { weekId: cur, weekXp: 0, tier, lastWeek: { tier: s.tier, rank, outcome, weekId: s.weekId } };
}

// Відновлення енергії за минулий час
function energyPatch(s: State, now: number): Partial<State> {
  let energy = s.energy;
  let energyAt = s.energyAt || now;
  if (energy >= MAX_ENERGY) {
    energyAt = now;
  } else {
    const ticks = Math.floor((now - energyAt) / ENERGY_REGEN_MS);
    if (ticks > 0) {
      energy = Math.min(MAX_ENERGY, energy + ticks * ENERGY_REGEN_AMOUNT);
      energyAt = energy >= MAX_ENERGY ? now : energyAt + ticks * ENERGY_REGEN_MS;
    }
  }
  const today = todayStr();
  let lastBonusDate = s.lastBonusDate;
  if (s.onboarded && lastBonusDate !== today) {
    lastBonusDate = today;
    if (energy < MAX_ENERGY) energy = Math.min(MAX_ENERGY, energy + DAILY_ENERGY_BONUS);
  }
  return { energy, energyAt, lastBonusDate };
}

// Скидає прогрес завдань, якщо настала нова доба
function questsRoll(s: State): Partial<State> {
  const today = todayStr();
  return s.questsDate === today ? {} : { questsDate: today, questProgress: {}, questsClaimed: [] };
}

function bump(p: Partial<Record<Metric, number>>, m: Metric, by: number, mode: 'add' | 'max' = 'add') {
  return { ...p, [m]: mode === 'max' ? Math.max(p[m] ?? 0, by) : (p[m] ?? 0) + by };
}

const FRESH = {
  onboarded: false,
  playerName: '',
  playerPhoto: null,
  charStart: 'caveman' as CharStart,
  energy: MAX_ENERGY,
  energyAt: 0,
  lastBonusDate: null,
  strictEnergy: false,
  notifEnabled: true,
  notifMorning: '08:00',
  notifEvening: '20:30',
  coins: 0,
  xp: 0,
  xpToday: 0,
  streak: 1,
  streakFreezes: 0,
  lastActiveDate: null,
  daysAway: 0,
  dailyGoal: 'regular' as DailyGoal,
  level: 1,
  completed: [] as string[],
  quiz: {} as QuizAnswers,
  comboShields: 0,
  hints: 0,
  doubleCoins: 0,
  frames: [] as string[],
  frame: 'green',
  totalCorrect: 0,
  totalErrors: 0,
  perfectLessons: 0,
  totalCoinsEarned: 0,
  purchases: 0,
  mistakesFixed: 0,
  goldenGlasses: false,
  diagnosticDone: false,
  history: [] as HistoryItem[],
  mistakes: [] as MistakeRef[],
  unlocked: [] as string[],
  campaigns: [] as Campaign[],
  srs: {} as SrsMap,
  simDate: '',
  simRuns: 0,
  questsDate: '',
  questProgress: {} as Partial<Record<Metric, number>>,
  questsClaimed: [] as string[],
  weekId: '',
  weekXp: 0,
  tier: 0,
  lastWeek: null as LastWeek | null,
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...FRESH,

      setHydrated: () => set({ hydrated: true }),

      setQuizAnswer: (key, value) => set((s) => ({ quiz: { ...s.quiz, [key]: value } })),

      finishOnboarding: (name, goal) =>
        set((s) => ({
          onboarded: true,
          playerName: name.trim() || 'Гравець',
          charStart: startFromExp(s.quiz.exp),
          dailyGoal: goal,
          lastActiveDate: todayStr(),
          lastBonusDate: todayStr(),
          energyAt: Date.now(),
          weekId: weekStartStr(),
        })),

      setPlayerName: (name) => set({ playerName: name.trim().slice(0, 14) }),

      setPlayerPhoto: (uri) => set({ playerPhoto: uri }),

      setDailyGoal: (goal) => set({ dailyGoal: goal }),

      setStrictEnergy: (v) => set({ strictEnergy: v }),

      setNotif: (p) => set(p),

      checkStreak: () =>
        set((s) => {
          const today = todayStr();
          let patch: Partial<State> = {};
          if (!s.lastActiveDate) {
            patch = { lastActiveDate: today };
          } else if (s.lastActiveDate === today) {
            if (s.daysAway) patch = { daysAway: 0 };
          } else {
            const gap = daysBetween(s.lastActiveDate, today);
            const away = { daysAway: gap };
            if (gap === 1) {
              patch = { ...away, streak: s.streak + 1, lastActiveDate: today, xpToday: 0 };
            } else if (gap === 2 && s.streakFreezes > 0) {
              patch = { ...away, streak: s.streak + 1, lastActiveDate: today, xpToday: 0, streakFreezes: s.streakFreezes - 1 };
            } else if (gap > 1) {
              patch = { ...away, streak: 1, lastActiveDate: today, xpToday: 0 };
            } else {
              patch = { lastActiveDate: today, xpToday: 0 };
            }
          }
          const next = { ...s, ...patch } as State;
          return withAchievements(s, { ...patch, ...rolloverWeek(next), ...questsRoll(next), ...energyPatch(next, Date.now()) });
        }),

      refreshEnergy: () =>
        set((s) => {
          const p = energyPatch(s, Date.now());
          return p.energy === s.energy && p.energyAt === s.energyAt && p.lastBonusDate === s.lastBonusDate ? {} : p;
        }),

      completeLesson: (id, coinsEarned, xpEarned, extra) =>
        set((s) => {
          const count = !extra?.practiceOnly;
          const completed = !count || s.completed.includes(id) ? s.completed : [...s.completed, id];
          const xp = s.xp + xpEarned;
          const perfect = !!extra && !extra.practiceOnly && extra.errors === 0 && extra.correct > 0;
          const history: HistoryItem[] = extra
            ? [
                { id, date: new Date().toISOString(), correct: extra.correct, errors: extra.errors, xp: xpEarned, coins: coinsEarned },
                ...s.history,
              ].slice(0, 60)
            : s.history;
          const week = rolloverWeek(s);
          const q0 = questsRoll(s);
          let qp = q0.questProgress ?? s.questProgress;
          qp = bump(qp, 'xp', xpEarned);
          if (count && !s.completed.includes(id)) qp = bump(qp, 'lessons', 1);
          if (perfect) qp = bump(qp, 'perfect', 1);
          if (extra?.isQuiz) qp = bump(qp, 'quiz', 1);
          if (extra?.maxCombo) qp = bump(qp, 'combo', extra.maxCombo, 'max');
          const patch: Partial<State> = {
            ...week,
            ...q0,
            questProgress: qp,
            completed,
            coins: s.coins + coinsEarned,
            xp,
            level: levelForXp(xp),
            xpToday: s.xpToday + xpEarned,
            weekXp: (week.weekXp ?? s.weekXp) + xpEarned,
            totalCoinsEarned: s.totalCoinsEarned + coinsEarned,
            totalCorrect: s.totalCorrect + (extra?.correct ?? 0),
            totalErrors: s.totalErrors + (extra?.errors ?? 0),
            perfectLessons: s.perfectLessons + (perfect ? 1 : 0),
            history,
            doubleCoins: extra?.doubled ? Math.max(0, s.doubleCoins - 1) : s.doubleCoins,
          };
          return withAchievements(s, patch);
        }),

      // Підсумок відповідей уроку: помилки потрапляють у «надолуження», правильні відповіді їх прибирають
      recordAnswers: (results) =>
        set((s) => {
          let mistakes = s.mistakes;
          let fixed = 0;
          const srs = { ...s.srs };
          const now = Date.now();
          for (const r of results) {
            const key = srsKey(r.lessonId, r.idx);
            srs[key] = reviewed(srs[key], r.ok, now);
            const at = mistakes.findIndex((m) => m.lessonId === r.lessonId && m.idx === r.idx);
            if (r.ok && at >= 0) {
              mistakes = mistakes.filter((_, i) => i !== at);
              fixed++;
            } else if (!r.ok && at < 0) {
              mistakes = [{ lessonId: r.lessonId, idx: r.idx }, ...mistakes];
            }
          }
          const q0 = questsRoll(s);
          const qp = fixed ? bump(q0.questProgress ?? s.questProgress, 'fixed', fixed) : q0.questProgress ?? s.questProgress;
          return withAchievements(s, { ...q0, srs, questProgress: qp, mistakes: mistakes.slice(0, 80), mistakesFixed: s.mistakesFixed + fixed });
        }),

      addCampaign: (c) => {
        const id = `c${Date.now().toString(36)}`;
        set((st) => ({ campaigns: [{ ...c, id, status: 'active', startDate: todayStr(), entries: [], changes: [] }, ...st.campaigns] }));
        return id;
      },

      updateCampaign: (id, patch) => set((st) => ({ campaigns: st.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),

      removeCampaign: (id) => set((st) => ({ campaigns: st.campaigns.filter((c) => c.id !== id) })),

      // запис дня: одна дата = один запис (перезаписується)
      saveEntry: (id, entry) =>
        set((st) => ({
          campaigns: st.campaigns.map((c) =>
            c.id === id ? { ...c, entries: [...c.entries.filter((e) => e.date !== entry.date), entry].sort((a, b) => a.date.localeCompare(b.date)) } : c
          ),
        })),

      addChange: (id, text) =>
        set((st) => ({
          campaigns: st.campaigns.map((c) => (c.id === id ? { ...c, changes: [{ ts: Date.now(), text: text.trim() }, ...c.changes].slice(0, 100) } : c)),
        })),

      // Нагорода симулятора: повна за перший запуск дня, далі 30% (щоб не фармити коїни)
      finishSim: (stars) => {
        const s = get();
        const today = todayStr();
        const runs = s.simDate === today ? s.simRuns : 0;
        const k = runs === 0 ? 1 : 0.3;
        const coins = Math.round([0, 15, 30, 50][stars] * k);
        const xp = Math.round([3, 8, 14, 20][stars] * k);
        set((st) => {
          const week = rolloverWeek(st);
          const q0 = questsRoll(st);
          const nxp = st.xp + xp;
          return withAchievements(st, {
            ...week,
            ...q0,
            questProgress: bump(q0.questProgress ?? st.questProgress, 'xp', xp),
            simDate: today,
            simRuns: runs + 1,
            coins: st.coins + coins,
            xp: nxp,
            level: levelForXp(nxp),
            xpToday: st.xpToday + xp,
            weekXp: (week.weekXp ?? st.weekXp) + xp,
            totalCoinsEarned: st.totalCoinsEarned + coins,
            history: [{ id: 'sim', date: new Date().toISOString(), correct: stars, errors: 0, xp, coins }, ...st.history].slice(0, 60),
          });
        });
        return { coins, xp };
      },

      claimQuest: (id) =>
        set((s) => {
          const q0 = questsRoll(s);
          const day = q0.questsDate ?? s.questsDate;
          const claimed = q0.questsClaimed ?? s.questsClaimed;
          const progress = q0.questProgress ?? s.questProgress;
          const def = questsForDay(day).find((q) => q.id === id);
          if (!def || claimed.includes(id) || (progress[def.metric] ?? 0) < def.target) return {};
          return withAchievements(s, {
            ...q0,
            questsClaimed: [...claimed, id],
            coins: s.coins + def.reward,
            totalCoinsEarned: s.totalCoinsEarned + def.reward,
          });
        }),

      spendEnergy: (n) =>
        set((s) => {
          const energy = Math.max(0, s.energy - n);
          // енергія почала витрачатись: відлік відновлення стартує звідси
          return { energy, energyAt: s.energy >= MAX_ENERGY ? Date.now() : s.energyAt };
        }),

      useComboShield: () => {
        if (get().comboShields <= 0) return false;
        set((s) => ({ comboShields: s.comboShields - 1 }));
        return true;
      },

      useHint: () => {
        if (get().hints <= 0) return false;
        set((s) => ({ hints: s.hints - 1 }));
        return true;
      },

      buyItem: (id) => {
        const s = get();
        const item = ITEMS.find((i) => i.id === id);
        if (!item) return 'poor';
        if (s.coins < item.cost) return 'poor';
        let patch: Partial<State> | null = null;
        switch (id) {
          case 'energy10':
          case 'energy20':
          case 'energyFull': {
            if (s.energy >= MAX_ENERGY) return 'max';
            const add = id === 'energy10' ? 10 : id === 'energy20' ? 20 : MAX_ENERGY;
            patch = { energy: Math.min(MAX_ENERGY, s.energy + add) };
            break;
          }
          case 'freeze':
            if (s.streakFreezes >= MAX_STREAK_FREEZES) return 'max';
            patch = { streakFreezes: s.streakFreezes + 1 };
            break;
          case 'shield3':
            patch = { comboShields: s.comboShields + 3 };
            break;
          case 'hint3':
            patch = { hints: s.hints + 3 };
            break;
          case 'double':
            if (s.doubleCoins >= 1) return 'max';
            patch = { doubleCoins: 1 };
            break;
          default:
            if (id.startsWith('frame_')) {
              const key = id.slice(6);
              if (s.frames.includes(key)) return 'owned';
              patch = { frames: [...s.frames, key], frame: key };
            }
        }
        if (!patch) return 'poor';
        set((st) => withAchievements(st, { ...patch, coins: st.coins - item.cost, purchases: st.purchases + 1 }));
        return 'ok';
      },

      equipFrame: (frame) => set((s) => (frame === 'green' || s.frames.includes(frame) ? { frame } : {})),

      // Діагностичний тест: skipTo = уроки, які вважаємо вже відомими (без нагороди)
      finishDiagnostic: (perfect, skipTo) =>
        set((s) =>
          withAchievements(s, {
            diagnosticDone: true,
            goldenGlasses: s.goldenGlasses || (perfect && !s.diagnosticDone),
            completed: [...s.completed, ...skipTo.filter((id) => !s.completed.includes(id))],
          })
        ),

      reset: () => set({ ...FRESH }),
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
