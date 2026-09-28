// Імпорт даних кампанії з Google Таблиці (або будь-якого CSV за посиланням).
// Спосіб: у таблиці «Файл → Опублікувати в Інтернеті → CSV» або доступ «за посиланням» для читання.
import type { Entry } from './advice';

// Приводимо посилання на таблицю до посилання на CSV
export function sheetsCsvUrl(input: string): string {
  const url = input.trim();
  if (!url) return '';
  if (/output=csv|format=csv/.test(url)) return url;
  const m = url.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/);
  if (!m) return url;
  // опубліковане посилання (…/d/e/2PACX…/pub) віддає CSV з параметром output=csv
  if (m[1] === 'e') return url.replace(/\/pub.*$/, '/pub?output=csv');
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1] ?? '0';
  return `https://docs.google.com/spreadsheets/d/${m[1]}/export?format=csv&gid=${gid}`;
}

// Простий CSV-парсер (лапки, коми й крапки з комою, переноси рядків)
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  const first = text.split('\n', 1)[0] ?? '';
  const delim = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ',';
  let cur: string[] = [];
  let cell = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else q = false;
      } else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) {
      cur.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      cur.push(cell);
      cell = '';
      if (cur.some((c) => c.trim() !== '')) rows.push(cur);
      cur = [];
    } else cell += ch;
  }
  cur.push(cell);
  if (cur.some((c) => c.trim() !== '')) rows.push(cur);
  return rows;
}

const num = (s: string | undefined): number => {
  if (!s) return 0;
  const v = parseFloat(s.replace(/[^\d.,-]/g, '').replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
};

// Нормалізуємо дату до YYYY-MM-DD з форматів 2026-09-27, 27.09.2026, 27/09/2026, 9/27/2026 (англ. американський не підтримуємо: день/місяць)
export function normDate(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

const COLS: Record<keyof Omit<Entry, 'date'> | 'date', RegExp> = {
  date: /^(date|дата|день|day)$/i,
  spend: /^(spend|spent|cost|витрати|витрачено|расход|расходы|витрата)/i,
  impressions: /^(impressions|impr|покази|показы|охват|reach)/i,
  clicks: /^(clicks|кліки|клики|link clicks)/i,
  leads: /^(leads|ліди|лиды|results|результати|conversions|конверсії)/i,
};

export type ParsedSheet = { entries: Entry[]; skipped: number; error?: string };

export function entriesFromCsv(text: string): ParsedSheet {
  const rows = parseCsv(text);
  if (rows.length < 2) return { entries: [], skipped: 0, error: 'У таблиці немає рядків з даними.' };
  const head = rows[0].map((h) => h.trim());
  const idx = (re: RegExp) => head.findIndex((h) => re.test(h));
  const di = idx(COLS.date);
  const si = idx(COLS.spend);
  if (di < 0 || si < 0) {
    return { entries: [], skipped: 0, error: 'У першому рядку мають бути назви колонок: Дата, Витрати, Покази, Кліки, Ліди.' };
  }
  const ii = idx(COLS.impressions);
  const ci = idx(COLS.clicks);
  const li = idx(COLS.leads);
  const entries: Entry[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const date = normDate(r[di] ?? '');
    if (!date) {
      skipped++;
      continue;
    }
    entries.push({
      date,
      spend: num(r[si]),
      impressions: ii >= 0 ? num(r[ii]) : 0,
      clicks: ci >= 0 ? num(r[ci]) : 0,
      leads: li >= 0 ? num(r[li]) : 0,
    });
  }
  return { entries, skipped };
}

export async function fetchSheet(link: string): Promise<ParsedSheet> {
  const url = sheetsCsvUrl(link);
  if (!url) return { entries: [], skipped: 0, error: 'Встав посилання на таблицю.' };
  try {
    const res = await fetch(url);
    if (!res.ok) return { entries: [], skipped: 0, error: `Не вдалося відкрити таблицю (код ${res.status}). Перевір, що вона опублікована або відкрита за посиланням.` };
    const text = await res.text();
    if (/<html/i.test(text.slice(0, 400))) {
      return { entries: [], skipped: 0, error: 'Таблиця закрита. Опублікуй її в Інтернеті або дай доступ за посиланням.' };
    }
    return entriesFromCsv(text);
  } catch (e) {
    return { entries: [], skipped: 0, error: 'Немає з’єднання або браузер заблокував запит. Спробуй опублікований CSV (Файл, Опублікувати в Інтернеті).' };
  }
}
