// «Порадник» для кампанії або групи оголошень: детермінований, ручний ввід, без мережі й без AI.
// Рахує за правилами методології автора аналізу реклами; на виході ОДНА дія й коротке «чому».
// Без імпортів: перевіряється автотестами (supabase/tests/advisor.test.ts).
//
// Порядок правил (перше, що спрацювало, і є порадою):
//  1. поганий сет-ап → новий запуск
//  2. «коли вбивати офер/товар» (явний поріг, нижче)
//  3. після останньої зміни пройшло менше 2 днів → нічого не чіпати (усі зміни під контроль 2–3 дні)
//  4. «качелі» → розділити (CBO) або перезапустити (ABO)
//  5. CPL вищий за поріг у межах бюджету → підняти контрольну ставку на 0,10–0,25 $
//     (якщо ставку вже піднімали багато разів → новий запуск)
//  6. кампанія «просить» (витрати над бюджетом на 7–20% за 2–3 дні) при нормальному CPL → +20% бюджету
//  7. інакше: тримати й перевірити через 2–3 дні
//
// Усі числові пороги нижче це параметри (за замовчуванням і редагуються в UI): автор підтверджує або міняє їх.

export type Structure = '1-1-1' | '1-2-1' | '1-3-1';
export type BudgetMode = 'ABO' | 'CBO';
export type BidHistory = 'none' | 'few' | 'many'; // ставку не піднімали / піднімали 1–2 рази / 3+ разів або вже перезапускали

export type AdvisorParams = {
  cplThreshold: number; // поріг CPL, $: вище нього ліди невигідні (за замовчуванням 3)
  killSpendMult: number; // «вбивати»: витрати без жодного ліда ≥ mult × поріг CPL
  killCplMult: number; // «вбивати»: CPL ≥ mult × поріг після ≥ killMinDays днів і спроб виправлення
  killMinDays: number;
  askMin: number; // «просить»: перевитрата від бюджету, частка (0,07 = 7%)
  budgetStep: number; // на скільки піднімати бюджет, частка (0,2 = +20%)
  bidStepSmall: number; // $
  bidStepBig: number; // $
  waitDays: number; // скільки днів не чіпати після зміни
};

export const DEFAULT_PARAMS: AdvisorParams = {
  cplThreshold: 3,
  killSpendMult: 3,
  killCplMult: 1.5,
  killMinDays: 4,
  askMin: 0.07,
  budgetStep: 0.2,
  bidStepSmall: 0.1,
  bidStepBig: 0.25,
  waitDays: 2,
};

export type AdvisorInput = {
  level: 'campaign' | 'adset';
  budget: number; // денний бюджет, $
  spend: number; // витрати за період, $
  days: number; // за скільки днів ці витрати (2–3)
  cpl: number | null; // поточний CPL, $ (null, якщо лідів ще нема)
  leadsPerDay: number;
  bid: number | null; // контрольна ставка, $ (null = без ставки / автоматично)
  bidHistory: BidHistory;
  mode: BudgetMode;
  structure: Structure;
  daysSinceLaunch: number;
  daysSinceChange: number; // днів від останньої зміни (0 = сьогодні)
  swings: boolean; // «качелі»: витрати чи CPL стрибають день у день
  badSetup: boolean; // сет-ап явно поганий / не за перевіреною схемою
};

export type AdvisorCode = 'invalid' | 'new_launch' | 'kill' | 'wait' | 'split' | 'restart' | 'raise_bid' | 'raise_budget' | 'hold';

export type AdvisorResult = {
  code: AdvisorCode;
  title: string; // 1 конкретна дія
  why: string[]; // коротко, чому
  value?: number; // нове значення (бюджет чи ставка), якщо є
};

const money = (n: number) => `$${(Math.round(n * 100) / 100).toFixed(2).replace(/\.00$/, '')}`;

// «3» → 3 дні тому; «2026-10-24» → різниця до today. Повертає null, якщо не розпізнано.
export function daysAgo(text: string, today: Date = new Date()): number | null {
  const t = text.trim();
  if (/^\d{1,3}$/.test(t)) return Number(t);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  const d = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = Math.round((now - d) / 86400000);
  return diff < 0 ? null : diff;
}

export function advise(inp: AdvisorInput, p: AdvisorParams = DEFAULT_PARAMS): AdvisorResult {
  const what = inp.level === 'campaign' ? 'кампанію' : 'групу';
  if (!(inp.budget > 0) || !(inp.days >= 1) || inp.spend < 0) {
    return { code: 'invalid', title: 'Заповни бюджет, витрати й кількість днів', why: ['Без цих трьох чисел порада була б вгадуванням.'] };
  }
  const threshold = p.cplThreshold;
  const hasLeads = inp.cpl != null && inp.cpl > 0 && inp.leadsPerDay > 0;
  const overPct = inp.spend / (inp.budget * inp.days) - 1; // перевитрата відносно бюджету

  // 1. поганий сет-ап
  if (inp.badSetup) {
    return {
      code: 'new_launch',
      title: `Не лікуй цей сет-ап: запусти ${what} наново`,
      why: ['Ти позначив сет-ап як поганий. Крутити ставку чи бюджет на кривій основі це спалювати гроші.', 'Збери заново за перевіреною структурою й запусти з чистого аркуша.'],
    };
  }

  // 2. коли вбивати офер/товар
  if (!hasLeads && inp.spend >= p.killSpendMult * threshold) {
    return {
      code: 'kill',
      title: 'Вимикай: офер чи товар не заходить',
      why: [`Витрачено ${money(inp.spend)} (≥ ${p.killSpendMult} × поріг CPL ${money(threshold)}) і лідів нема.`, 'Далі лити не варто: гроші підуть у нікуди. Перевір тільки, чи не зламаний трекінг чи сторінка.'],
    };
  }
  if (hasLeads && inp.cpl! >= p.killCplMult * threshold && inp.daysSinceLaunch >= p.killMinDays && inp.bidHistory !== 'none') {
    return {
      code: 'kill',
      title: 'Вимикай: офер чи товар не окуповується',
      why: [`CPL ${money(inp.cpl!)} це ≥ ${p.killCplMult} × поріг ${money(threshold)} уже на ${inp.daysSinceLaunch}-й день.`, 'Ставку вже підкручували, а ціна ліда не вертається. Далі це не лікується правками.'],
    };
  }

  // 3. не чіпати 2–3 дні після зміни
  if (inp.daysSinceChange < p.waitDays) {
    return {
      code: 'wait',
      title: `Нічого не чіпай ще ${p.waitDays - inp.daysSinceChange} дн.`,
      why: [`Остання зміна була ${inp.daysSinceChange === 0 ? 'сьогодні' : `${inp.daysSinceChange} дн. тому`}. Усі зміни роби під контролем: дай системі ${p.waitDays}–3 дні й дивись на результат.`, 'Дві правки поспіль не дозволяють зрозуміти, що саме спрацювало.'],
    };
  }

  // 4. качелі
  if (inp.swings) {
    if (inp.mode === 'CBO') {
      return {
        code: 'split',
        title: 'Розділи: винеси переможну групу в окрему кампанію',
        why: ['CBO розкидає бюджет між групами нерівно, звідси «качелі».', 'Перенеси ту групу, що дає ліди, в окрему кампанію (ABO) і дай їй стабільний бюджет.'],
      };
    }
    return {
      code: 'restart',
      title: `Перезапусти ${what}: дублюй і лий з чистим навчанням`,
      why: ['При ABO «качелі» означають, що навчання збилось.', 'Дублікат із тими самими налаштуваннями часто стабілізується; стару вимкни, коли нова набере лідів.'],
    };
  }

  // 5. CPL вище порогу в межах бюджету
  if (hasLeads && inp.cpl! > threshold && overPct < p.askMin) {
    if (inp.bidHistory === 'many') {
      return {
        code: 'restart',
        title: `Ставку вже піднімали багато разів: перезапусти ${what}`,
        why: [`CPL ${money(inp.cpl!)} вищий за поріг ${money(threshold)}, а ставка вже піднімалась 3+ рази.`, 'Ще один крок ставки не допоможе: потрібен новий запуск.'],
      };
    }
    const gap = (inp.cpl! - threshold) / threshold;
    const step = gap > 0.3 ? p.bidStepBig : p.bidStepSmall;
    const next = inp.bid != null ? Math.round((inp.bid + step) * 100) / 100 : undefined;
    return {
      code: 'raise_bid',
      title: inp.bid != null ? `Підніми контрольну ставку: ${money(inp.bid)} → ${money(next!)}` : `Підніми контрольну ставку на ${money(step)}`,
      value: next,
      why: [
        `CPL ${money(inp.cpl!)} вищий за поріг ${money(threshold)}, а витрати в межах бюджету: ${what} не добирає обсяг, ставка їй тісна.`,
        `Крок ${money(step)} (діапазон ${money(p.bidStepSmall)}–${money(p.bidStepBig)}): більший розрив з порогом, більший крок. Потім 2–3 дні не чіпай.`,
      ],
    };
  }

  // 6. «просить»
  if (hasLeads && inp.cpl! <= threshold && overPct >= p.askMin) {
    const next = Math.round(inp.budget * (1 + p.budgetStep) * 100) / 100;
    return {
      code: 'raise_budget',
      title: `Підніми бюджет на ${Math.round(p.budgetStep * 100)}%: ${money(inp.budget)} → ${money(next)}`,
      value: next,
      why: [`${what[0].toUpperCase() + what.slice(1)} «просить»: витрати на ${Math.round(overPct * 100)}% вищі за бюджет за ${inp.days} дн., а CPL ${money(inp.cpl!)} у нормі (≤ ${money(threshold)}).`, `Крок не більше ${Math.round(p.budgetStep * 100)}% за раз, потім 2–3 дні спостерігай.`],
    };
  }

  // 7. тримай
  if (!hasLeads) {
    return {
      code: 'hold',
      title: 'Тримай і дай набрати витрати',
      why: [`Лідів ще нема, але й порогу «вбивати» (${money(p.killSpendMult * threshold)} витрат без ліда) не досягнуто.`, 'Перевір через 2–3 дні.'],
    };
  }
  if (inp.cpl! > threshold) {
    return {
      code: 'hold',
      title: 'Бюджет не піднімай: дочекайся стабілізації',
      why: [`CPL ${money(inp.cpl!)} вищий за поріг ${money(threshold)}, а ${what} ще й перевитрачає бюджет.`, 'Підняття бюджету при дорогому ліді множить збиток. Дай 2–3 дні; якщо CPL не впаде, див. поріг «вбивати».'],
    };
  }
  return {
    code: 'hold',
    title: 'Нічого не змінюй: усе в нормі',
    why: [`CPL ${money(inp.cpl!)} у межах порогу ${money(threshold)}, перевитрати бюджету нема.`, 'Перевір цифри знову через 2–3 дні.'],
  };
}
