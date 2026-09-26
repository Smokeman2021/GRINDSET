// «Мої цифри»: типи й аналіз кампанії за правилами курсу (модулі 05, 08). Орієнтири, а не закон Meta.
export type Entry = { date: string; spend: number; impressions: number; clicks: number; leads: number };
export type Change = { ts: number; text: string };
export type Campaign = {
  id: string;
  name: string;
  payout: number; // виплата за апрувнутий лід, $
  approve: number; // апрув-рейт 0..1
  startDate: string;
  status: 'active' | 'paused';
  entries: Entry[];
  changes: Change[];
  remindTimes: string[]; // «HH:MM» кілька разів на день; порожньо = без нагадувань
};

export type Advice = { level: 'good' | 'warn' | 'bad' | 'info'; text: string };

export type Totals = {
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  cpm: number;
  ctr: number;
  cpc: number;
  cr: number;
  cpl: number;
  income: number;
  profit: number;
  roi: number;
};

const div = (a: number, b: number) => (b > 0 ? a / b : NaN);

export function totalsOf(c: Campaign, entries: Entry[] = c.entries): Totals {
  const spend = entries.reduce((s, e) => s + e.spend, 0);
  const impressions = entries.reduce((s, e) => s + e.impressions, 0);
  const clicks = entries.reduce((s, e) => s + e.clicks, 0);
  const leads = entries.reduce((s, e) => s + e.leads, 0);
  const income = leads * c.approve * c.payout;
  return {
    spend,
    impressions,
    clicks,
    leads,
    cpm: div(spend, impressions) * 1000,
    ctr: div(clicks, impressions) * 100,
    cpc: div(spend, clicks),
    cr: div(leads, clicks) * 100,
    cpl: div(spend, leads),
    income,
    profit: income - spend,
    roi: div(income - spend, spend) * 100,
  };
}

export const breakEvenCpl = (c: Campaign) => c.payout * c.approve;

const money = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`;

export function analyze(c: Campaign): Advice[] {
  const out: Advice[] = [];
  const es = [...c.entries].sort((a, b) => a.date.localeCompare(b.date));
  if (es.length === 0) {
    return [{ level: 'info', text: 'Додай перший день даних: витрати, покази, кліки й ліди з кабінету.' }];
  }
  const be = breakEvenCpl(c);
  const t = totalsOf(c, es);
  const last2 = es.slice(-2);
  const last3 = es.slice(-3);
  const t3 = totalsOf(c, last3);

  if (es.length < 2) {
    out.push({ level: 'info', text: 'Поки один день. Оцінюй у розрізі 2–3 днів: перший день часто без лідів, алгоритм ще пристрілюється.' });
  }

  // Правило 2 днів
  if (last2.length === 2 && last2.every((e) => e.spend > 0 && e.leads === 0)) {
    out.push({
      level: 'bad',
      text: 'Два дні поспіль без лідів. Правило 2 днів: перевір креатив, ленд і офер, перероби або перезапусти. Не давай адсету відкручувати повний бюджет без результату.',
    });
  }

  // Гранична вартість ліда
  if (Number.isFinite(t3.cpl)) {
    if (t3.cpl > be * 1.2) {
      out.push({
        level: 'bad',
        text: `CPL за 3 дні ${money(t3.cpl)} вищий за беззбитковий ${money(be)} більш ніж на 20%. Це збиток: вимикай або переробляй. Збільшувати бюджет, щоб «відбитись», не варто.`,
      });
    } else if (t3.cpl > be) {
      out.push({ level: 'warn', text: `CPL ${money(t3.cpl)} трохи вищий за беззбитковий ${money(be)}. Ще день-два спостерігай, але не збільшуй бюджет.` });
    } else {
      out.push({
        level: 'good',
        text: `CPL ${money(t3.cpl)} нижчий за беззбитковий ${money(be)}. Не чіпай те, що працює. Масштаб: 10–20% раз на 2 дні, не частіше. Дублі кампаній це новий запуск у навчанні.`,
      });
    }
  }

  // Воронка: покази → кліки → ліди (орієнтири для товарки, не закон)
  if (Number.isFinite(t.ctr) && t.impressions >= 1000) {
    if (t.ctr < 0.8) out.push({ level: 'warn', text: `CTR ${t.ctr.toFixed(2)}%: низький. Слабкий креатив або аудиторія: протестуй нові крео. (Орієнтир, залежить від ніші.)` });
    else if (t.ctr >= 1.5) out.push({ level: 'good', text: `CTR ${t.ctr.toFixed(2)}%: креатив чіпляє.` });
  }
  if (Number.isFinite(t.cr) && t.clicks >= 100) {
    if (t.cr < 2) out.push({ level: 'warn', text: `Конверсія кліка в лід ${t.cr.toFixed(1)}%: низька. Дивись ленд, швидкість завантаження, відповідність оголошення і оферу.` });
  }
  if (Number.isFinite(t.cpm) && t.cpm > 20) {
    out.push({ level: 'info', text: `CPM ${money(t.cpm)}: дорогий трафік. Перевір аудиторію й розклад, пікові години 16:00–20:00 зазвичай дорожчі.` });
  }

  // Ефективний підсумок
  if (es.length >= 3 && t.profit < 0 && Number.isFinite(t.roi)) {
    out.push({ level: 'info', text: `За весь час: витрати ${money(t.spend)}, прибуток ${money(t.profit)}, ROI ${t.roi.toFixed(0)}%. Перший запуск часто в мінус, це нормально, якщо ти робиш висновки.` });
  }

  const days = new Set(c.changes.map((ch) => new Date(ch.ts).toDateString()));
  if (c.changes.length === 0) {
    out.push({ level: 'info', text: 'Записуй кожну зміну (бюджет, крео, аудиторія). Без журналу за тиждень не згадаєш, що спрацювало.' });
  } else if (days.size < es.length / 2) {
    out.push({ level: 'info', text: 'Зміни записані не щодня. Фіксуй і причину, бо потім важко зрозуміти результат.' });
  }
  return out;
}
