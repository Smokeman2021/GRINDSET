import { brief, choice, match, multi, numeric, order, type BStep } from '../branch.ts';
import { handbookExercises } from './handbookExercises.ts';

type Exercise = {
  id: string;
  types: string[];
  states: string;
  input: string;
  answer: string;
  decision: string;
  evidence: string;
  nextStep: string;
  wrongAnswer: string;
};
type ChapterPractice = { prompt: string; exercises: Exercise[] };
export const handbookPracticeBank: Readonly<Record<string, ChapterPractice>> = handbookExercises;

const aliases: Record<string, string> = { '0-final': 'final0', '1-final': 'final1', 'final2': '2-final' };
const titleCase = (text: string) => text.slice(0, 1).toLocaleUpperCase('uk') + text.slice(1);
const sentence = (text: string) => /[.!?]$/.test(text) ? titleCase(text) : titleCase(text) + '.';
const badOption = (text: string) => text.split(/;|(?<=[.!?])\s+(?=[А-ЯІЇЄҐA-Z])/u)[0].trim();

function numberedOptions(values: string[]) {
  return '\n\n' + values.map((value, index) => (index + 1) + '. ' + value).join('\n');
}

// Labels correspond to the ordered numeric outputs in the released workbook.
// Unlabelled values remain in the written exercise and are reviewed with its rubric.
const math: Record<string, string[]> = {
  'START-02': ['Нарахування, USD'],
  'START-03': ['Нарахування A', 'Нарахування B', 'Підтверджена фіксована частина C'],
  'START-05': ['Доступно на рекламу', 'Касова потреба'],
  'START-07': ['Межа реклами', 'Касова потреба', 'Кількість оплачуваних дій'],
  'BASE-02': ['Сервіс', 'Чисте нарахування', 'Фактичний рекламний CPL', 'Граничний рекламний CPL', 'Чистий EPC', 'Результат', 'ROI, %', 'Касова потреба'],
  'BASE-03': ['Частка завантажень після кнопки, %'],
  'BASE-21': ['Повний бюджет', 'Поріг для варіанта'],
  'BASE-22': ['Частка завантажень A, %', 'Підтвердження серед закритих C, %', 'Нижня межа C, %', 'Верхня межа C, %'],
  'BASE-23': ['Вільна капа за підтвердженими діями', 'Вільна капа з діями в черзі', 'Касова потреба'],
  'BASE-24': ['Планова межа CPL', 'Касова потреба', 'Фактичний CPL', 'Апрув, %', 'Нарахування', 'Результат', 'EPC', 'ROI, %', 'Зріла межа рекламного CPL'],
  'INFRA-04': ['Рекламний спенд', 'Рахунок платіжного журналу', 'Повні витрати тесту'],
  'INFRA-08': ['Фінансовий результат', 'Касова потреба'],
  'INFRA-10': ['Касова потреба'],
  'TOV-02': ['Апрув, %', 'Викуп від підтверджених, %', 'Викуп від прийнятих, %', 'Результат', 'Межа CPL', 'Касова потреба', 'Результат у зміненому сценарії'],
  'TOV-07': ['Результат'],
  'TOV-08': ['Касова потреба', 'Раннє нарахування', 'Ранній апрув від усіх, %', 'Ранній апрув від оброблених, %', 'Зрілий апрув, %', 'Зрілий викуп від підтверджених, %', 'Зріла наскрізна частка, %', 'Зрілий результат', 'Фактичний CPL', 'Межа рекламного CPL'],
  'NUT-02': ['Апрув, %', 'Викуп від підтверджених, %', 'Наскрізна частка, %', 'Межа CPL', 'Касова потреба', 'Результат', 'Результат після сторнування'],
  'NUT-07': ['Фінансовий результат'],
  'NUT-08': ['Касова потреба', 'Раннє нарахування', 'Ранній апрув від усіх, %', 'Ранній апрув від опрацьованих, %', 'Зрілий апрув, %', 'Зрілий викуп, %', 'Зріла наскрізна частка, %', 'Зрілий результат', 'Фактичний CPL', 'Межа CPL'],
  'ECOM-02': ['Виручка', 'Внесок', 'ROAS до повернення', 'ROAS після повернення', 'Результат із дублем', 'Результат без дубля'],
  'ECOM-03': ['Перша сума', 'Друга сума'],
  'ECOM-08': ['Рання чиста виручка', 'Ранній результат', 'Ранній валовий ROAS', 'Касова потреба', 'Зріла виручка', 'Зрілий внесок', 'Чистий ROAS', 'Поріг чистого ROAS', 'Зрілий результат', 'Межа за стоком', 'Межа за чергою', 'Межа за касою'],
  'DAT-02': ['Перша частка, %', 'Друга частка, %', 'Наскрізна частка, %', 'Нарахування', 'Межа CPL', 'Результат', 'Результат після коригування'],
  'DAT-07': ['Касова потреба', 'Раннє нарахування', 'Ранній DOI серед опрацьованих, %', 'Ранній DOI серед усіх, %', 'Зрілий результат', 'Зрілий DOI, %', 'Оплати від DOI, %', 'Фактичний CPL', 'Межа CPL'],
  'INFO-02': ['Явка, %', 'Дохід на реєстрацію', 'Межа', 'Результат', 'Касова потреба', 'Результат після сторнування'],
  'INFO-07': ['Явка, %', 'Частка початків оплати, %', 'Раннє нарахування', 'Касова потреба', 'Зріле нарахування', 'Зрілий результат', 'Дохід на реєстрацію', 'Фактичний CPL', 'Межа CPL', 'Вільна капа'],
  'MOB-02': ['CPI', 'Повернення D1, %', 'Повернення D7, %', 'Повна ціна дії', 'Межа CPI', 'Результат', 'Результат після коригування'],
  'MOB-07': ['Перший результат', 'Другий результат', 'Вільна капа'],
  'MOB-08': ['Рекламний CPI', 'Повернення D1, %', 'Раннє нарахування', 'Касова потреба', 'Повернення D7, %', 'Підтверджені вступи, %', 'Зараховані дії, %', 'Повна вартість дії', 'Зрілий результат', 'Вільна капа'],
  'BET-02': ['CPA', 'Перше нарахування RevShare', 'Друге нарахування RevShare'],
  'BET-03': ['Частка реєстрацій, %', 'Частка FTD, %', 'Середній депозит', 'Перший фінансовий результат', 'Другий фінансовий результат', 'Третій фінансовий результат'],
  'BET-06': ['Виплата за моделлю «Табло», USD'],
  'BET-08': ['Нарахування, USD', 'Різниця, USD'],
  'BET-F': ['Частка 6 із 18 за «Табло», %', 'Нарахування «Табло»', 'Результат «Табло»', 'Попереднє нарахування «Кола»', 'Зріле нарахування «Кола»', 'Зрілий результат «Кола»'],
  'FIN-01': ['CPL, USD', 'CPA позики, USD', 'CPA криптобіржі, USD'],
  'FIN-02': ['Частка схвалень, %', 'Результат CPL, USD', 'Результат CPA, USD'],
  'FIN-F': ['Ранній FIN CPA, нарахування', 'Ранній CRY CPA, нарахування', 'Зрілий FIN CPL, нарахування', 'Зрілий FIN CPL, результат', 'Зрілий FIN CPA, нарахування', 'Зрілий FIN CPA, результат', 'Зрілий CRY CPA, нарахування', 'Зрілий CRY CPA, результат', 'Каса FIN', 'Каса CRY'],
  'SWP-01': ['Перше нарахування, USD', 'Друге нарахування, USD', 'Перший результат, USD', 'Другий результат, USD', 'Каса, USD'],
  'SWP-05': ['Перший результат, USD', 'Другий результат, USD'],
  'ADW-01': ['Перший результат, USD', 'Другий результат, USD'],
  'SRC-01': ['Результат, USD'],
  'SRC-02': ['Результат, USD'],
  'SRC-03': ['Перший результат, USD', 'Другий результат, USD'],
  'SRC-08': ['Повні витрати, USD', 'Результат, USD', 'Поріг, дій'],
  'SRC-04': ['Перший результат, USD', 'Другий результат, USD', 'Третій результат, USD'],
  'SRC-05': ['CPI, USD', 'Результат, USD', 'Різниця, відсоткові пункти'],
  'SRC-06': ['Перший результат, USD', 'Другий результат, USD'],
  'SRC-F': ['Раннє нарахування', 'CPC Search', 'Зрілий результат Search', 'Зрілий результат Meta', 'Каса Search'],
};

// These source keys are written as sentences instead of scalar arrays.
const compoundAnswers: Record<string, number[]> = {
  'BET-F': [33.33, 90, 15, 110, 80, -5],
  'FIN-F': [30, 48, 108, 8, 90, -10, 96, 8, -100, -88],
  'SRC-F': [32, 0.40, 24, 22, -72],
};

const ordered: Record<string, string[]> = {
  'BASE-03': ['Преленд', 'Кнопка', 'Лендинг', 'Прийнята заявка', 'Зарахування', 'Викуп'],
  'BASE-10': ['D', 'A', 'C', 'E', 'B'],
  'TOV-03': ['Оголошення', 'Огляд із заміром', 'Лендинг', 'Необхідна форма', 'Подяка'],
  'NUT-03': ['Оголошення', 'Підписаний огляд', 'Лендинг', 'Форма', 'Подяка'],
  'ECOM-03': ['Оголошення', 'Товар', 'Кошик', 'Чекаут', 'Підтвердження'],
};

const mappings: Record<string, [string, string][]> = {
  'START-01': [['Баєр', 'Платить рекламному майданчику'], ['Покупець', 'Платить продавцеві'], ['Партнерська мережа', 'Платить баєру за зарахований викуп']],
  'START-06': [['Апрув', 'Реєстр приймання та підтверджень'], ['Викуп', 'Записи доставки'], ['Холд', 'Картка виплати']],
  'BASE-03': [['Лендинг', 'Звіт сайту'], ['Прийнята заявка', 'Реєстр партнера'], ['Викуп', 'Звіт доставки']],
  'BASE-06': [['Перший кадр A', 'К1'], ['Перший кадр B', 'К2'], ['Спільний доказ', 'К3'], ['CTA', 'К4']],
  'INFRA-07': [['Тімлід', 'Бюджет'], ['Креативник', 'Матеріали'], ['Техспец', 'Тест'], ['Баєр', 'Висновок']],
};

function writtenRubric(exercise: Exercise): string {
  return [
    '**Рішення.** ' + sentence(exercise.decision),
    '**Доказ.** ' + sentence(exercise.evidence),
    '**Наступний крок.** ' + sentence(exercise.nextStep),
    '**Типова помилка.** ' + sentence(exercise.wrongAnswer),
  ].join('\n\n');
}

function numericFields(exercise: Exercise) {
  const labels = math[exercise.id];
  if (!labels) return [];
  const values = compoundAnswers[exercise.id] ?? exercise.answer.replace(/^\[|\]$/g, '').split(',').flatMap((piece) => {
    const match = /^\s*[\$₴]?\s*([+−-]?\d+(?:\.\d+)?)\s*(?:USD|PLN|UAH|%|відсоткові пункти|дії)?\s*$/i.exec(piece);
    return match ? [Number(match[1].replace('−', '-'))] : [];
  });
  if (labels.length !== values.length) return [];
  return labels.map((label, index) => {
    const answer = values[index];
    return { label, answer, tolerance: label === 'Частка 6 із 18 за «Табло», %' ? 0.05 : Number.isInteger(answer) ? 0 : 0.01 };
  });
}

function proofSteps(exercise: Exercise, scenario: string): BStep[] {
  const steps: BStep[] = [];
  const sequence = ordered[exercise.id];
  const pairs = mappings[exercise.id];
  const fields = numericFields(exercise);
  const explain = sentence(exercise.evidence);
  if (sequence) steps.push(order('Віднови маршрут за брифом', sequence, explain, { part: 'data', scenario }));
  if (pairs) steps.push(match('Зістав елементи, які потрібно звірити', pairs, explain, { part: 'data', scenario }));
  for (let start = 0; start < fields.length; start += 4) {
    steps.push(numeric('Розрахуй показники за брифом', fields.slice(start, start + 4), explain, { part: 'data', scenario }));
  }

  // The source includes explicit verdicts for every card. Preserve the card IDs and
  // the approved dispositions rather than inventing advertising policy at runtime.
  if (exercise.types.includes('Модератор')) {
    const verdicts = [...exercise.answer.matchAll(/(?:^|[\[,])\s*([A-EА-Д]|\d+):?\s+(пропустити|відхилити|так|ні)(?=\s*[,\]])/giu)];
    for (let start = 0; start < verdicts.length; start += 5) {
      const group = verdicts.slice(start, start + 5);
      steps.push({
        type: 'bundle', layer: 2, part: 'data', q: 'Оціни картки за умовами цієї вправи', scenario,
        slots: group.map((entry) => ({
          label: 'Картка ' + entry[1],
          options: ['Продовжити перевірку картки', 'Виправити картку чи відкласти'],
          answer: /^(пропустити|так)$/i.test(entry[2]) ? 0 : 1,
        })),
        okMsg: 'Рішення відповідають брифу.', noMsg: 'Звір умови для кожної картки.', explain,
      });
    }
    const mistakenProof = sentence(badOption(exercise.wrongAnswer));
    if (verdicts.length && explain !== mistakenProof) {
      steps.push(match('Зістав підставу й типову помилку перевірки', [
        [explain, 'Доказ, який звіряємо'],
        [mistakenProof, 'Хибна підстава'],
      ], explain, { part: 'data', scenario, explainField: true }));
    }
  }

  const row = /tap_row[^,\]]*?1[–-]([45])/.exec(exercise.input);
  const target = /^\[([1-5])(?:,|\])/.exec(exercise.answer);
  if (steps.length === 0 && row && target && Number(target[1]) <= Number(row[1])) {
    const rows = Array.from({ length: Number(row[1]) }, (_, j) => 'Рядок ' + (j + 1));
    steps.push(multi('Познач рядок, який потребує першої перевірки', rows, [Number(target[1]) - 1], explain,
      { part: 'data', scenario, explainField: true }));
  }

  if (steps.length === 0) {
    steps.push(match('Розклади висновок із брифу за складовими', [
      [sentence(exercise.decision), 'Рішення'],
      [sentence(exercise.evidence), 'Перевірний доказ'],
      [sentence(exercise.nextStep), 'Наступна дія'],
    ], explain, { part: 'data', scenario, explainField: true }));
  }
  return steps;
}

function caseSteps(exercise: Exercise, prompt: string): BStep[] {
  const scenario = prompt;
  const decision = sentence(exercise.decision);
  const wrong = sentence(badOption(exercise.wrongAnswer));
  const explain = '**Перевірка рішення.** ' + sentence(exercise.evidence) +
    '\n\n**Типова помилка.** ' + sentence(exercise.wrongAnswer);
  const preciseChoices = decision.length <= wrong.length * 1.2 && decision !== wrong;
  const dialogue = exercise.types.some((type) => type === 'Діалог' || type === 'День за днем');
  const correctChoice = [...exercise.id].reduce((sum, item) => sum + item.charCodeAt(0), 0) % 2;
  const decisionOptions = correctChoice === 0 ? [decision, wrong] : [wrong, decision];
  const offerChoice = exercise.types.includes('Оціни офер')
    ? /^\[\s*([ABC])(?=\s*[,\]])/.exec(exercise.answer)
    : null;
  const cards = ['A', 'B', 'C'].filter((letter) => new RegExp(`(?<![\\p{L}])${letter}(?![\\p{L}])`, 'u').test(prompt));
  const offerAnswer = offerChoice ? cards.indexOf(offerChoice[1]) : -1;
  const decisionCheck: BStep = offerAnswer >= 0 && cards.length > 1
    ? choice('Яку картку береш у підготовку?', cards.map((card) => 'Картка ' + card), offerAnswer, explain,
      { part: 'decision', scenario, explainField: true })
    : preciseChoices && dialogue
    ? {
      type: 'story', layer: 2, part: 'decision',
      q: exercise.types.includes('Діалог') ? 'Відповідай на робочу ситуацію' : 'Прийми рішення за доступним зрізом',
      intro: 'Звір бриф, перш ніж обирати реакцію.',
      scenario,
      scenes: [{ text: 'Яка реакція підтверджена матеріалами вправи?', options: [
        { label: decision, good: true, feedback: sentence(exercise.evidence) },
        { label: wrong, good: false, feedback: sentence(exercise.wrongAnswer) },
      ] }],
      passRatio: 1, okMsg: 'Рішення обґрунтовано.', noMsg: 'Звір висновок з умовами брифу.', explain,
    }
    : preciseChoices
      ? choice('Обери робоче рішення за умовами брифу', [decision, wrong], 0, explain,
        { part: 'decision', scenario, explainField: true })
      : choice('Оціни, яке рішення узгоджується з брифом', ['Рішення 1', 'Рішення 2'], correctChoice, explain,
        { part: 'decision', scenario: scenario + '\n\n**Запропоновані рішення.**' + numberedOptions(decisionOptions), explainField: true });
  const next = sentence(exercise.nextStep);
  const skip = 'Закрити запис за поточним зрізом без повторної звірки.';
  const candidates = [skip, 'Передати поточний висновок як остаточний і не призначати відповідального.'];
  const nextAnswer = (correctChoice + exercise.types.length) % 3;
  candidates.splice(nextAnswer, 0, next);
  const nextStep: BStep = {
    type: 'bundle', layer: 2, part: 'next', q: 'Обери рекомендацію для робочого журналу', explainField: true,
    scenario: scenario + '\n\n**Запропоновані дії.**' + numberedOptions(candidates),
    slots: [{ label: 'Що зробиш наступним кроком?', options: ['Дія 1', 'Дія 2', 'Дія 3'], answer: nextAnswer }],
    okMsg: 'Наступну перевірку заплановано.', noMsg: 'Перечитай умови та визнач, чого ще бракує.', explain: next,
  };
  return [decisionCheck, ...proofSteps(exercise, scenario), nextStep];
}

// Repeating the cash-flow case can use another deterministic set of values.
// Pass a persisted variant number to keep the same values when resuming.
function cashFlowPractice(variant: number): BStep[] {
  const revision = Number.isSafeInteger(variant) ? Math.abs(variant) % 6 : 0;
  const spend = 32 + revision * 3;
  const materials = 8 + revision;
  const rate = 9 + revision;
  const costs = spend + materials;
  const accepted = 5 * rate;
  const summary = `Офер чохлів у США. Покупець платить магазину $28. Партнерка зараховує баєру \`$${rate}\` за викуп.`;
  return [
    brief('Практика за брифом', summary + '\n\nРухайся від витрат і заявок до підтвердження партнера. Дані відкриваються по черзі.'),
    match('Зістав платників і грошові потоки', mappings['START-01'],
      'Покупець платить магазину, баєр оплачує рекламу, партнерка нараховує виплату баєру.', { part: 'decision', scenario: summary }),
    numeric('Зріз 1 · Скільки грошей уже витрачено?', [{ label: 'Витрати, USD', answer: costs }],
      'До касової потреби входять реклама й матеріали.', { part: 'data', scenario: `Звіт містить 12 прийнятих заявок. Оплачено $${spend} за рекламу та $${materials} за матеріали.` }),
    {
      type: 'story', layer: 2, part: 'decision', q: 'Зріз 2 · Що змінилося після обробки?',
      intro: 'Із 12 заявок 6 підтверджено, 3 відхилено, 3 ще відкриті. Переказу немає.',
      scenes: [
        { text: 'Який статус дасть нарахування?', options: [
          { label: 'Зарахований викуп у реєстрі', good: true, feedback: 'Угода визначає викуп як оплачувану дію.' },
          { label: 'Телефонне підтвердження заявки', good: false, feedback: 'Дзвінок підтверджує намір, а гроші нараховують за викуп.' },
        ] },
        { text: 'Як оплатити повтор до переказу?', options: [
          { label: 'Передбачити окремий бюджет', good: true, feedback: 'Запис про статус не поповнює касу.' },
          { label: 'Списати гроші з нарахувань', good: false, feedback: 'Переказу ще немає. До нього потрібні власні кошти.' },
        ] },
      ],
      passRatio: 1, okMsg: 'Статус і фінансування визначено.', noMsg: 'Звір умову виплати й стан каси.',
      explain: 'Підтвердження, нарахування й переказ мають різні дати.',
    },
    numeric('Зріз 3 · Звір нарахування, результат і касу', [
      { label: 'Нарахування, USD', answer: accepted },
      { label: 'Результат за 5 викупів, USD', answer: accepted - costs },
      { label: 'Власні витрати до переказу, USD', answer: costs },
      { label: 'Результат за 4 викупи, USD', answer: 4 * rate - costs },
    ], `Зістав нарахування з уже оплаченими витратами $${costs}.`, { part: 'data',
      scenario: `Партнерка зарахувала 5 викупів по $${rate} і ще не переказала гроші. Реклама коштувала $${spend}, матеріали — $${materials}.` }),
    choice('Яку дату додаси до журналу перед повтором?', [
      'Фактичний переказ на рахунок.',
      'Перший дзвінок за заявкою.',
    ], 0, 'Звір дату переказу, щоб вирішити, чи вистачить доступних грошей на повтор.', { part: 'next' }),
  ];
}

export function handbookPractice(lessonId: string, variant = 0): BStep[] {
  const key = Object.hasOwn(aliases, lessonId) ? aliases[lessonId] : lessonId;
  if (key === '0.1') return cashFlowPractice(variant);
  if (!Object.hasOwn(handbookPracticeBank, key)) return [];
  const record = handbookPracticeBank[key];
  if (!record) return [];
  const practical = record.exercises.flatMap((exercise) => caseSteps(exercise, record.prompt));
  return [
    brief('Практика за брифом', record.prompt),
    ...practical,
    brief('Звірка відкритого рішення', record.exercises.map(writtenRubric).join('\n\n---\n\n')),
  ];
}

export function handbookPracticeFor(ids: readonly string[]): BStep[] {
  return ids.flatMap((id) => handbookPractice(id));
}
