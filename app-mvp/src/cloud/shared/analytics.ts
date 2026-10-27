// Мініаналітика закритого тесту: чиста логіка підсумків. Без імпортів, перевіряється автотестами (supabase/tests/analytics.test.ts).
// Події: session_start (відкрив застосунок/увійшов), lesson_start, lesson_complete, lesson_exit (вийшов на кроці props.step з props.total).

export const EVENT_NAMES = ['session_start', 'lesson_start', 'lesson_complete', 'lesson_exit'] as const;
export type EventName = (typeof EVENT_NAMES)[number];

export type EventLike = { name: string; username: string; props: Record<string, unknown> | null };

export type LessonStat = { lesson: string; starts: number; completes: number; exits: number; completion: number | null; avgExitStep: number | null };
export type EventSummary = { events: number; users: number; sessions: number; lessons: LessonStat[] };

// completion = завершені ÷ розпочаті (у %, 1 знак); null, якщо ще ніхто не починав. avgExitStep: середній крок виходу (з 1).
export function summarizeEvents(rows: EventLike[]): EventSummary {
  const users = new Set<string>();
  const by = new Map<string, { starts: number; completes: number; exits: number; exitSum: number }>();
  let sessions = 0;
  for (const r of rows) {
    users.add(r.username);
    if (r.name === 'session_start') sessions++;
    const lesson = typeof r.props?.lesson === 'string' ? r.props.lesson : '';
    if (!lesson || !r.name.startsWith('lesson_')) continue;
    const s = by.get(lesson) ?? { starts: 0, completes: 0, exits: 0, exitSum: 0 };
    if (r.name === 'lesson_start') s.starts++;
    else if (r.name === 'lesson_complete') s.completes++;
    else if (r.name === 'lesson_exit') {
      s.exits++;
      s.exitSum += (Number(r.props?.step) || 0) + 1;
    }
    by.set(lesson, s);
  }
  const lessons: LessonStat[] = [...by.entries()]
    .map(([lesson, s]) => ({
      lesson,
      starts: s.starts,
      completes: s.completes,
      exits: s.exits,
      completion: s.starts > 0 ? Math.round((Math.min(s.completes, s.starts) / s.starts) * 1000) / 10 : null,
      avgExitStep: s.exits > 0 ? Math.round((s.exitSum / s.exits) * 10) / 10 : null,
    }))
    .sort((a, b) => b.starts - a.starts || a.lesson.localeCompare(b.lesson));
  return { events: rows.length, users: users.size, sessions, lessons };
}
