// Особистий маршрут: із відповідей опитування складаємо лінійний план (порядок модулів той самий,
// але позначаємо фокус, пропозицію пропуску й оцінку часу). Правила прості й прозорі.
import { MODULES } from './modules';
import { SKILL_LEVELS } from './quiz';

export type PlanItem = {
  moduleId: string;
  title: string;
  lessons: number;
  tag: 'core' | 'focus' | 'skip';
  reason: string;
};

export type Plan = { items: PlanItem[]; totalLessons: number; weeks: number; summary: string };

const level = (a: Record<string, string>, key: string) => Math.max(0, SKILL_LEVELS.indexOf((a[key] ?? 'Не знаю') as (typeof SKILL_LEVELS)[number]));

// Модуль → яка навичка з опитування його стосується
const MODULE_SKILL: Record<number, string | undefined> = {
  3: 'sk_offers',
  4: 'sk_offers',
  6: 'sk_creo',
  7: 'sk_lands',
  8: 'sk_analytics',
  9: 'sk_safety',
};

const plural = (n: number, one: string, few: string, many: string) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};

export function buildPlan(a: Record<string, string>): Plan {
  const metrics = level(a, 'sk_metrics');
  const goal = a.goal ?? '';
  const fear = a.fear ?? '';
  const deadline = a.deadline ?? '';
  const cabinetSkilled = /Запускав|Керую/.test(a.cabinet ?? '');

  const fast = deadline.includes('тиждень');
  const items: PlanItem[] = MODULES.map((m, i) => {
    const n = i + 1;
    let tag: PlanItem['tag'] = 'core';
    let reason = 'Основа курсу';
    const sk = MODULE_SKILL[n];
    const lvl = sk ? level(a, sk) : n <= 2 ? Math.max(metrics, cabinetSkilled ? 2 : 0) : 0;

    if (n <= 2 && lvl >= 2) {
      tag = 'skip';
      reason = 'Ти вже знаєш це: пропусти або пройди коротку перевірку';
    } else if (sk && lvl >= 2) {
      tag = 'skip';
      reason = 'Ти сказав, що вмієш: пройди коротку перевірку й пропусти';
    }
    if (tag !== 'skip') {
      if (/бізнес/.test(goal) && (n === 4 || n === 8)) {
        tag = 'focus';
        reason = 'Для власного бізнесу це ключове';
      } else if (/найман/.test(goal) && n === 10) {
        tag = 'focus';
        reason = 'Кар\'єра: портфоліо, кейси, де шукати роботу';
      } else if (/Бани/.test(fear) && n === 9) {
        tag = 'focus';
        reason = 'Ти боїшся банів: цей модуль про безпеку';
      } else if (/Злити/.test(fear) && (n === 8 || n === 5)) {
        tag = 'focus';
        reason = 'Щоб не зливати бюджет: аналітика й правила запуску';
      } else if (/Не розумію/.test(fear) && n <= 3) {
        tag = 'focus';
        reason = 'Терміни й базові поняття на самому початку';
      }
    }
    return { moduleId: m.id, title: m.title, lessons: m.lessons.length, tag, reason };
  });

  // Терміновий запуск: мінімальний шлях
  if (fast) {
    const keep = new Set([1, 2, 5, 8]);
    items.forEach((it, i) => {
      if (!keep.has(i + 1) && it.tag !== 'skip') {
        it.tag = 'skip';
        it.reason = 'Не потрібно для першого запуску за тиждень: повернешся пізніше';
      }
    });
  }

  const todo = items.filter((i) => i.tag !== 'skip');
  const totalLessons = todo.reduce((s, i) => s + i.lessons, 0);
  const t = a.time ?? '';
  const minPerDay = t.includes('5-10') ? 8 : t.includes('15-20') ? 17 : t.includes('30+') ? 35 : t.includes('Скільки') ? 45 : 15;
  const lessonsPerWeek = Math.max(2, Math.round((minPerDay / 7) * 5));
  const weeks = Math.max(1, Math.ceil(totalLessons / lessonsPerWeek));
  const summary = `${todo.length} ${plural(todo.length, 'модуль', 'модулі', 'модулів')}, ${totalLessons} ${plural(totalLessons, 'урок', 'уроки', 'уроків')}, приблизно ${weeks} ${plural(weeks, 'тиждень', 'тижні', 'тижнів')}`;
  return { items, totalLessons, weeks, summary };
}
