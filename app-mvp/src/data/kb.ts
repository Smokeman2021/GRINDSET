// «База» (ТЗ 004, етап B): статті, кейси, вправи й шаблони за єдиним ID. Дані збирає scripts/import-kb.mjs з content/kb-source/
// за білим списком content/kb-include.json (у бандл іде лише він). Урок, гілка, «База» й тренажер відкривають ту саму статтю за ID.
import META from './generated/kb/meta.ts';
import UK from './generated/kb/texts.uk.ts';
import RU from './generated/kb/texts.ru.ts';
import EN from './generated/kb/texts.en.ts';
import type { Lang } from '../i18n/strings';
import { parseNum } from './numInput.ts';

export type KbSection = 'guides' | 'glossary' | 'software' | 'tools' | 'templates';
export type KbTask = 'offer' | 'measure' | 'creative' | 'cabinet' | 'geo' | 'risk';
export type KbVertical = 'tov' | 'srv' | 'inf' | 'nut' | 'dat' | 'gam' | 'cry' | 'adt';
export type KbKind = 'card' | 'case' | 'vertical' | 'template' | 'exercise' | 'method' | 'read-report' | 'guide' | 'branch';

export type KbField =
  | { id: string; type: 'number'; label: string; unit?: string; answer: number; tolerance: number }
  | { id: string; type: 'choice'; label: string; options: string[]; correct: number }
  | { id: string; type: 'multi'; label: string; options: string[]; correct: number[] };

export type KbMeta = { id: string; kind: KbKind; section: KbSection; verticals: (KbVertical | 'all')[]; tasks: KbTask[]; labels: string[]; starter: boolean; langs: Lang[] };
type KbText = { title: string; body: string; solution?: string; exercise?: { fields: KbField[]; criteria: string[] } };
export type KbArticle = KbMeta & KbText & { lang: Lang; fallback: boolean };

const ITEMS = (META as { items: KbMeta[] }).items;
const TEXTS: Record<Lang, Record<string, KbText>> = { uk: UK as Record<string, KbText>, ru: RU as Record<string, KbText>, en: EN as Record<string, KbText> };
const BY_ID = new Map(ITEMS.map((m) => [m.id, m]));

export const KB_SECTIONS: { id: KbSection; title: string; icon: string }[] = [
  { id: 'guides', title: 'Гайди', icon: '📘' },
  { id: 'glossary', title: 'Глосарій', icon: '🔤' },
  { id: 'software', title: 'Софт', icon: '🧰' },
  { id: 'tools', title: 'Інструменти', icon: '🧮' },
  { id: 'templates', title: 'Шаблони', icon: '📋' },
];
export const KB_TASKS: { id: KbTask; title: string }[] = [
  { id: 'offer', title: 'Офер і економіка' },
  { id: 'measure', title: 'Вимірювання' },
  { id: 'creative', title: 'Креатив і воронка' },
  { id: 'cabinet', title: 'Кабінет' },
  { id: 'geo', title: 'GEO' },
  { id: 'risk', title: 'Ризики й допуск' },
];
export const KB_VERTICALS: { id: KbVertical; title: string }[] = [
  { id: 'tov', title: 'Товарка' },
  { id: 'srv', title: 'Послуги' },
  { id: 'inf', title: 'Інфобіз' },
  { id: 'nut', title: 'Нутра' },
  { id: 'dat', title: 'Дейтинг' },
  { id: 'gam', title: 'Гемблінг' },
  { id: 'cry', title: 'Крипта' },
  { id: 'adt', title: 'Адалт' },
];
export const KB_KIND_LABEL: Partial<Record<KbKind, string>> = { case: 'Кейс', exercise: 'Вправа', method: 'Методичка', template: 'Шаблон', vertical: 'Вертикаль', 'read-report': 'Вправа' };

// Мітки джерела даних (ТЗ 004, B10). Правило майданчика — лише з content/policy-facts.json (етап C2), тут його немає.
export function labelText(l: string): string {
  if (l === 'training-data') return 'Навчальні дані';
  if (l === 'self-report') return 'Самозвіт автора';
  if (l === 'our-calc') return 'Наш розрахунок';
  if (l === 'geo-tiers') return 'Тири GEO — за класифікаціями рекламних мереж';
  if (l === 'ads-manager-hint') return '«14–24%» — підказка кабінету Ads Manager, перевірено 16.11.2026';
  if (l.startsWith('benchmark:')) return `Опублікований бенчмарк · ${l.slice(10)}`;
  return l;
}

export const kbIds = (): string[] => ITEMS.map((m) => m.id);
export const kbMeta = (id: string): KbMeta | undefined => BY_ID.get(id);

// Стаття мовою інтерфейсу; немає перекладу → українська з позначкою fallback (екран показує «Відкрито українською»)
export function kbGet(id: string, lang: Lang): KbArticle | null {
  const m = BY_ID.get(id);
  if (!m) return null;
  const own = TEXTS[lang]?.[id];
  const t = own ?? TEXTS.uk[id];
  if (!t) return null;
  return { ...m, ...t, lang: own ? lang : 'uk', fallback: !own && lang !== 'uk' };
}

export type KbFilter = { section?: KbSection; vertical?: KbVertical | null; task?: KbTask | null; query?: string };
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[’'`]/g, "'");

// Пошук: заголовок, текст і (для глосарію — окремо на екрані) терміни. Розбір і еталони не шукаються, щоб не підказувати.
export function kbList(lang: Lang, f: KbFilter = {}): KbArticle[] {
  const q = f.query ? norm(f.query.trim()) : '';
  return ITEMS.filter((m) => (!f.section || m.section === f.section) && (!f.vertical || m.verticals.includes('all') || m.verticals.includes(f.vertical)) && (!f.task || m.tasks.includes(f.task)))
    .map((m) => kbGet(m.id, lang))
    .filter((a): a is KbArticle => !!a)
    .filter((a) => !q || norm(`${a.id} ${a.title} ${a.body}`).includes(q))
    .sort((a, b) => {
      if (!q) return 0;
      const ta = norm(`${a.id} ${a.title}`).includes(q) ? 0 : 1;
      const tb = norm(`${b.id} ${b.title}`).includes(q) ? 0 : 1;
      return ta - tb;
    });
}

// Стартова добірка (ТЗ 004, B7); картки кейсу «Ліди» додаються на етапі D
export const KB_STARTER: { title: string; ids: string[] }[] = [
  { title: 'Країни й GEO', ids: ['GEO-01'] },
  { title: 'Економіка й апрув', ids: ['ECO-01', 'ECO-02', 'ECO-03', 'ECO-04', 'PAY-01'] },
  { title: 'Перевірка офера', ids: ['M22-01'] },
  { title: 'Вимірювання', ids: ['M22-02', 'TRK-01'] },
  { title: 'Бриф креативу й воронка', ids: ['M22-03', 'EXP-02', 'EXP-03'] },
];

// Перевірка відповіді поля вправи
export function fieldCorrect(f: KbField, v: unknown): boolean {
  if (f.type === 'number') {
    // спільний розбір числа (ТЗ 006, 5.3): «−» (U+2212), кома, пробіли між розрядами; порожнє поле — не 0
    const n = typeof v === 'string' ? parseNum(v) : typeof v === 'number' ? v : NaN;
    return Number.isFinite(n) && Math.abs(n - f.answer) <= f.tolerance + 1e-9;
  }
  if (f.type === 'choice') return v === f.correct;
  const got = Array.isArray(v) ? [...(v as number[])].sort() : [];
  return JSON.stringify(got) === JSON.stringify([...f.correct].sort());
}

// Пункти чекліста й поля шаблону з методички M22 (нумеровані кроки; «**Шаблон …:** a | b | c»)
export function templateParts(body: string): { steps: string[]; forms: { title: string; fields: string[] }[]; rest: string } {
  const steps: string[] = [];
  const forms: { title: string; fields: string[] }[] = [];
  const rest: string[] = [];
  for (const para of body.split(/\n\n+/)) {
    const lines = para.split('\n');
    if (lines.every((l) => /^\d+\.\s/.test(l))) {
      steps.push(...lines.map((l) => l.replace(/^\d+\.\s*/, '')));
      continue;
    }
    const m = para.match(/^\*\*([^*]+?):\*\*\s*([\s\S]+)$/);
    if (m && m[2].includes('|')) {
      forms.push({ title: m[1], fields: m[2].replace(/\.\s*$/, '').split('|').map((x) => x.trim()).filter(Boolean) });
      continue;
    }
    if (m && /^Перед публікацією/.test(m[1])) {
      steps.push(...m[2].split(/(?<=\.)\s+/).map((x) => x.trim()).filter(Boolean));
      continue;
    }
    rest.push(para);
  }
  return { steps, forms, rest: rest.join('\n\n') };
}
