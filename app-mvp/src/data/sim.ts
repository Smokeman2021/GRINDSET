// Симулятор кампанії «5 днів медіабаєра»: гравець керує однією зв'язкою за правилами з модуля 08.
// Числа вигадані для навчання. Реальні цифри залежать від оферу, гео і креативу.
export type SimAction = 'keep' | 'up20' | 'up100' | 'down30' | 'pause';

export type SimDay = {
  day: number;
  budget: number;
  spend: number;
  leads: number;
  cpl: number | null; // null, якщо лідів не було
  income: number;
  profit: number;
  action?: SimAction; // рішення, прийняте ПІСЛЯ цього дня
  note?: string;
};

export type SimCase = {
  payout: number;
  approve: number; // частка апрувів
  startBudget: number;
  trueCpl: number; // прихована «справжня» вартість ліда зв'язки
};

export const DAYS = 5;

export function newCase(): SimCase {
  // приблизно половина зв'язок збиткові: це чесно для першого запуску
  const trueCpl = 2.4 + Math.random() * 5.6;
  return { payout: 12, approve: 0.4, startBudget: 20, trueCpl };
}

export const breakEvenCpl = (c: SimCase) => c.payout * c.approve;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);

// Результати одного дня: шум великий в перші дні, різкі зміни бюджету збивають навчання
export function playDay(c: SimCase, day: number, budget: number, history: SimDay[]): SimDay {
  const noise = day === 1 ? 0.6 : day === 2 ? 0.35 : 0.2;
  let cpl = c.trueCpl * (1 + rnd(-noise, noise));
  // збільшили бюджет вчора: адсет знову «навчається» і дорожчає
  const prev = history[history.length - 1];
  if (prev?.action === 'up100') cpl *= c.trueCpl < 1.5 ? 1.05 : 1.45;
  else if (prev?.action === 'up20') cpl *= 1.08;
  else if (prev?.action === 'down30') cpl *= 1.05;
  const noLeads = day === 1 && Math.random() < 0.35; // перший день часто без лідів
  const leads = noLeads ? 0 : Math.max(0, Math.round(budget / cpl));
  const spend = budget;
  const income = leads * c.approve * c.payout;
  return {
    day,
    budget,
    spend,
    leads,
    cpl: leads > 0 ? spend / leads : null,
    income,
    profit: income - spend,
  };
}

export function nextBudget(budget: number, action: SimAction): number {
  if (action === 'up20') return Math.round(budget * 1.2 * 100) / 100;
  if (action === 'up100') return budget * 2;
  if (action === 'down30') return Math.round(budget * 0.7 * 100) / 100;
  return budget;
}

export type Verdict = { stars: 0 | 1 | 2 | 3; title: string; lines: string[]; profit: number; spend: number };

// Підсумок і розбір рішень
export function judge(c: SimCase, days: SimDay[]): Verdict {
  const spend = days.reduce((s, d) => s + d.spend, 0);
  const profit = days.reduce((s, d) => s + d.profit, 0);
  const be = breakEvenCpl(c);
  const good = c.trueCpl < be;
  const pausedAt = days.find((d) => d.action === 'pause')?.day;
  const lines: string[] = [];
  lines.push(
    good
      ? `Зв'язка була прибутковою: справжній CPL ≈ $${c.trueCpl.toFixed(2)} при беззбитковому $${be.toFixed(2)}.`
      : `Зв'язка була збитковою: справжній CPL ≈ $${c.trueCpl.toFixed(2)}, а беззбитковий лише $${be.toFixed(2)}.`
  );

  let stars: 0 | 1 | 2 | 3 = 1;
  if (good) {
    if (pausedAt && pausedAt <= 2) {
      lines.push('Ти вимкнув зв\'язку зарано: один-два дні це шум, алгоритм ще пристрілюється. Правило: оцінюй у розрізі 2–3 днів.');
      stars = 1;
    } else if (pausedAt) {
      lines.push('Ти вимкнув прибуткову зв\'язку. Перед вимкненням перевір, чи це не тимчасовий провал.');
      stars = 1;
    } else {
      stars = profit > 0 ? 3 : 2;
      lines.push('Ти не чіпав те, що працює, і дав алгоритму час. Це головне правило.');
    }
    if (days.some((d) => d.action === 'up100') && c.trueCpl >= 1.5) {
      lines.push('Подвоєння бюджету на не «наливному» товарі збило навчання. Масштабуй на 10–20% раз на 2 дні.');
      stars = Math.min(stars, 2) as 0 | 1 | 2 | 3;
    }
  } else {
    if (pausedAt && pausedAt <= 3) {
      lines.push('Вчасно вимкнув збиткову зв\'язку: не дав злити весь бюджет. Це навичка, яка рятує гроші.');
      stars = 3;
    } else if (pausedAt) {
      lines.push('Вимкнув, але пізніше, ніж міг. Гранична вартість ліда: якщо перевищено, не чекай.');
      stars = 2;
    } else {
      lines.push('Ти відкрутив усі 5 днів на збитковій зв\'язці. Правило 2 днів: два дні поспіль без результату, перевіряй чи вимикай.');
      stars = 0;
    }
    if (days.some((d) => d.action === 'up20' || d.action === 'up100') && !pausedAt) {
      lines.push('Збільшувати бюджет, щоб «відбитись», не варто.');
    }
  }
  return { stars, title: ['Злив бюджет', 'Так собі', 'Непогано', 'Красиво'][stars], lines, profit, spend };
}
