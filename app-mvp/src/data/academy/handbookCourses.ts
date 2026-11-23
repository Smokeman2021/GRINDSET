import { ACADEMY_CODES, HANDBOOK_TRACKS, handbookRouteId, type HandbookTrack } from '../academyIds.ts';
import { brief, unit, type Branch, type Unit } from '../branch.ts';
import { ACADEMY } from './courses.ts';
import { handbookLessons, type HandbookLesson } from './handbookData.ts';
import { handbookPractice } from './handbookPractice.ts';

const SPECIALIZATIONS = {
  MOB: { title: 'Мобайл', emoji: '📱', scenario: 'Залучення й події в мобільних застосунках' },
  SWP: { title: 'Підписки та розіграші', emoji: '🎟️', scenario: 'Умови продукту, списання й перевірка допуску' },
  TTK: { title: 'TikTok Ads', emoji: '🎬', scenario: 'Окремий курс з реклами у TikTok' },
};
const previous = new Map(ACADEMY.map((branch) => [branch.code, branch]));

function handbookUnit(entry: HandbookLesson): Unit {
  const id = handbookRouteId(entry);
  const steps = handbookPractice(entry.sourceId);
  return {
    ...unit(id, entry.title, [entry.id], [brief(entry.title, entry.reading), ...steps]),
    module: { id: entry.groupId, title: entry.groupTitle },
    boss: entry.isFinal,
    handbookSource: entry.sourceId,
  };
}

function toBranch(track: HandbookTrack): Branch {
  const code = `${track}-A2` as const;
  const original = previous.get(`${track}-A1` as Branch['code']);
  const specialty = track in SPECIALIZATIONS ? SPECIALIZATIONS[track as keyof typeof SPECIALIZATIONS] : null;
  const entries = handbookLessons.filter((entry) => entry.track === track);
  const reading = entries.map(handbookUnit);
  if (!reading.length) throw new Error(`Відсутній курс посібника: ${track}`);
  const final = reading.find((item) => item.id === `BR-${code}-FINAL`) ?? null;
  const first = entries.find((entry) => !entry.isFinal) ?? entries[0];
  return {
    code,
    title: original?.title ?? specialty?.title ?? track,
    emoji: original?.emoji ?? specialty?.emoji ?? '📗',
    scenario: original?.scenario ?? specialty?.scenario ?? 'Посібник і практика',
    intro: first.preview,
    kbCard: first.id,
    regulated: original?.regulated ?? track === 'SWP',
    wgb: '',
    lessons: reading.filter((item) => item !== final),
    selfcheck: [],
    practice: { id: `BR-${code}-PR`, title: '', steps: [], kb: [], ready: false },
    final,
  };
}

export const HANDBOOK = HANDBOOK_TRACKS.map(toBranch);
export const ACADEMY_HOME = HANDBOOK.filter((branch) => ACADEMY_CODES.some((track) => branch.code === `${track}-A2`));
export const HANDBOOK_SPECIALIZATIONS = HANDBOOK.filter((branch) =>
  !ACADEMY_CODES.some((track) => branch.code === `${track}-A2`),
);
