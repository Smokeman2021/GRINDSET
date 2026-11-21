import { ACADEMY_CODES, type AcademyTrack } from '../academyIds.ts';
import { brief, unit, type Branch } from '../branch.ts';
import { lessonIds } from '../branchRules.ts';
import { assessments } from './assessments.ts';
import { exercises } from './exercises.ts';
import { verticalExercises } from './verticalExercises.ts';
import { lessonContent } from './lessonContent.ts';

const config: Record<AcademyTrack, { title: string; emoji: string; kbCard: string; regulated?: boolean }> = {
  STA: { title: 'Старт', emoji: '🧭', kbCard: 'TRK-01' },
  TOV: { title: 'Товарка', emoji: '📦', kbCard: 'VRT-02' },
  SRV: { title: 'Послуги', emoji: '🤝', kbCard: 'VRT-04' },
  INF: { title: 'Інфобіз', emoji: '🎓', kbCard: 'SUB-01' },
  NUT: { title: 'Нутра', emoji: '🌿', kbCard: 'NUT-01', regulated: true },
  DAT: { title: 'Дейтинг', emoji: '💬', kbCard: 'SUB-06', regulated: true },
  GAM: { title: 'Гемблінг', emoji: '🎲', kbCard: 'RSK-03', regulated: true },
  CRY: { title: 'Крипта', emoji: '🔎', kbCard: 'RSK-05', regulated: true },
  ADT: { title: 'Адалт', emoji: '🔞', kbCard: 'RSK-07', regulated: true },
};

export const ACADEMY: Branch[] = ACADEMY_CODES.map((track) => {
  const assessment = assessments[track];
  const meta = config[track];
  const source = lessonContent[track];
  const code = `${track}-A1` as const;
  const prefix = `BR-${code}`;
  const ids = lessonIds(code);
  const lessons = source.lessons.map((item, index) => {
    const exercise = exercises[item.id] ?? verticalExercises[item.id];
    if (!exercise?.length) throw new Error(`Відсутня вправа: ${item.id}`);
    return unit(ids[index], item.title, item.kb, [
      ...item.paragraphs.map((body, i) => brief(i === 0 ? item.title : 'Розбір', body)),
      ...exercise,
    ]);
  });
  return {
    code, title: meta.title, emoji: meta.emoji, kbCard: meta.kbCard, regulated: meta.regulated ?? false,
    scenario: track === 'STA' ? 'Безкоштовний вступ до всіх вертикалей' : 'Пояснення, практика й самостійний кейс',
    intro: source.intro,
    wgb: track === 'TOV' ? 'Білий сценарій: підтверджені характеристики й прозорі умови. Сірий сигнал: бракує доказу. Чорний маркер: вигадана інформація або навмисно викривлена звітність.' : '',
    lessons,
    selfcheck: assessment.diagnostic,
    practice: assessment.practice
      ? unit(`${prefix}-PR`, 'Практика після самоперевірки', [meta.kbCard], assessment.practice)
      : { id: `${prefix}-PR`, title: '', steps: [], kb: [], ready: false },
    final: assessment.final ? unit(`${prefix}-FINAL`, 'Самостійний кейс', [meta.kbCard], assessment.final) : null,
  };
});
