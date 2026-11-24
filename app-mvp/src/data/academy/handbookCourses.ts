import { ACADEMY_CODES, ACADEMY_LESSONS, HANDBOOK_TRACKS, handbookRouteId, type HandbookTrack } from '../academyIds.ts';
import { brief, unit, type Branch, type Unit } from '../branch.ts';
import { ACADEMY } from './courses.ts';
import type { HandbookLesson } from './handbookData.ts';
import { handbookPractice } from './handbookPractice.ts';
import { servicesQuickPractice, servicesSelfcheck, servicesSteps } from './servicesLearning.ts';

const SPECIALIZATIONS = {
  MOB: { title: 'Мобайл', emoji: '📱', scenario: 'Залучення й події в мобільних застосунках' },
  SWP: { title: 'Підписки та розіграші', emoji: '🎟️', scenario: 'Умови продукту, списання й перевірка допуску' },
  TTK: { title: 'TikTok Ads', emoji: '🎬', scenario: 'Окремий курс з реклами у TikTok' },
};

const COURSE_DESCRIPTIONS: Record<HandbookTrack, string> = {
  STA: 'Як працює реклама, хто кому платить і як порахувати результат.',
  TOV: 'Реклама товарів: від заявки до оплаченого замовлення.',
  SRV: 'Реклама послуг: від заявки до виконаної й оплаченої роботи.',
  INF: 'Реклама курсів: від знайомства до покупки й повернень.',
  NUT: 'Товари для здоров’я: реклама, перевірка обіцянок і замовлення.',
  DAT: 'Сервіси знайомств: від реєстрації до активності й оплати.',
  GAM: 'Азартні ігри: правила реклами, депозити й виплати.',
  CRY: 'Криптосервіси: правила реклами, перевірка особи й оплата.',
  ADT: 'Продукти 18+: правила реклами, підписки й повернення.',
  MOB: 'Реклама застосунків: від встановлення до цільової дії.',
  SWP: 'Як перевіряти умови підписок, списань і розіграшів.',
  TTK: 'Як підготувати, запустити й оцінити рекламу в TikTok.',
};

const previous = new Map(ACADEMY.map((branch) => [branch.code, branch]));

function handbookUnit(entry: HandbookLesson): Unit {
  const id = handbookRouteId(entry);
  const steps = entry.track === 'SRV' ? servicesSteps(entry.sourceId) : handbookPractice(entry.sourceId);
  return {
    ...unit(id, entry.title, [entry.id], [brief(entry.title, entry.reading), ...steps]),
    module: { id: entry.groupId, title: entry.groupTitle },
    boss: entry.isFinal,
    handbookSource: entry.sourceId,
  };
}

function toBranch(track: HandbookTrack): Branch & { description: string } {
  const code = `${track}-A2` as const;
  const original = previous.get(`${track}-A1` as Branch['code']);
  const specialty = track in SPECIALIZATIONS ? SPECIALIZATIONS[track as keyof typeof SPECIALIZATIONS] : null;
  const entries = ACADEMY_LESSONS.filter((entry) => entry.track === track);
  const reading = entries.map(handbookUnit);
  if (!reading.length) throw new Error(`Відсутній курс посібника: ${track}`);
  const final = reading.find((item) => item.id === `BR-${code}-FINAL`) ?? null;
  const first = entries.find((entry) => !entry.isFinal) ?? entries[0];
  return {
    code,
    title: original?.title ?? specialty?.title ?? track,
    description: COURSE_DESCRIPTIONS[track],
    emoji: original?.emoji ?? specialty?.emoji ?? '📗',
    scenario: original?.scenario ?? specialty?.scenario ?? 'Посібник і практика',
    intro: first.preview,
    kbCard: track === 'SRV' ? 'HB-SRV-BRIEF' : first.id,
    regulated: original?.regulated ?? track === 'SWP',
    wgb: '',
    lessons: reading.filter((item) => item !== final),
    selfcheck: track === 'SRV' ? servicesSelfcheck : [],
    practice: track === 'SRV'
      ? unit(`BR-${code}-PR`, 'Практика перед фіналом', ['HB-SRV-TRACKING'], servicesQuickPractice)
      : { id: `BR-${code}-PR`, title: '', steps: [], kb: [], ready: false },
    final,
  };
}

export const HANDBOOK = HANDBOOK_TRACKS.map(toBranch);
export const ACADEMY_HOME = HANDBOOK.filter((branch) => ACADEMY_CODES.some((track) => branch.code === `${track}-A2`));
export const HANDBOOK_SPECIALIZATIONS = HANDBOOK.filter((branch) =>
  !ACADEMY_CODES.some((track) => branch.code === `${track}-A2`),
);
