# Згадки назв продуктів третіх сторін і логотипи Meta

Файл генерує `node scripts/brand-mentions.mjs` (розділи 2–4 автоматично), розділи 1 і 5 пишуться вручну в самому скрипті. Не редагувати вручну.

Правило: у шапці, назвах модулів, назві застосунку, іконках і метаданих назв продуктів третіх сторін нема. Описові згадки в тексті уроків не змінювалися.

## 1. Що прибрано з оболонки застосунку

- Шапка застосунку: було «FB АРБІТРАЖ», тепер назва курсу з `app-mvp/src/brand.ts` (`COURSE_NAME` = «Арбітраж трафіку»; en/ru: `COURSE_NAMES`).
- Назва модуля 02: було «Facebook: знайомство та фундамент», тепер «Рекламна платформа: знайомство та фундамент» (`src/data/modules.ts`). Нову назву перевірити автору.
- Назва модуля 05 (uk/en/ru): перевизначена в `content/overrides.json` (ключ `titles:m5`), importer застосовує її до всіх мов. Нові назви перевірити автору.
- Питання онбордингу/адаптації «А з рекламним кабінетом Facebook?» → «А з рекламним кабінетом?».
- Бібліотека → Рекламний кабінет: описи без «Facebook Ads Manager».
- Метадані: `app.json` (name = GRINDSET, опис без згадок бренду, `web.name`/`web.shortName`); `package.json` (`grindset-mvp`). Назва вкладки браузера = GRINDSET.
- Додано дисклеймер (`META_DISCLAIMER` у `brand.ts`): дрібно на першому екрані онбордингу і в Налаштування → Про застосунок.

## 2. Згадки в інтерфейсі й коді застосунку (залишились)

Це описові тексти (підказки, репліки Гріндіка, пояснення, службові коментарі) і назви розділів. Для перегляду автору.

| Файл | Рядок | Текст |
|---|---|---|
| app-mvp/app/adsim.tsx | 15 | // бо мета — впізнати реальний Ads Manager, а не наш дизайн. |
| app-mvp/app/adsim.tsx | 101 | <GrindykSay text="Спробуємо налаштування кампанії — так само, як у справжньому Ads Manager. 5 рішень, кожне впливає на результат." pose="laptop" heigh |
| app-mvp/app/adsim.tsx | 104 | <Text style={styles.introLine}>• Екрани виглядають так само, як реальний кабінет Facebook.</Text> |
| app-mvp/app/numbers/index.tsx | 100 | Дані лишаються на твоєму пристрої. Підключення до Facebook напряму (через Meta API) заплановане, потребує схвалення Meta. Поради: практика курсу, а не |
| app-mvp/app/settings.tsx | 158 | Навчальний контент про performance-маркетинг. Не фінансова порада і не гарантія доходу. Результати залежать від бюджету, ніші та виконання. Політики M |
| app-mvp/app/sim.tsx | 99 | <Text style={styles.small}>Це практика автора курсу, а не офіційна документація Meta.</Text> |
| app-mvp/src/components/BmExplorer.tsx | 11 | // роут і без шапки-квізу. Це і є "вбудований Ads Manager", який досліджують руками, а не читають. |
| app-mvp/src/components/Calculators.tsx | 116 | Правило з курсу: якщо перший лід прийшов за X, докручуєш до X + 15–20%. Не прийшов другий, вимикаєш. Це практика, а не закон Meta. |
| app-mvp/src/data/adsSim.ts | 1 | // Клікабельний тренажер рекламного кабінету: копія реальних екранів Facebook Ads Manager |
| app-mvp/src/data/adsSim.ts | 31 | talk: 'Перше і найважливіше рішення — мета кампанії. Від неї залежить, кого й як Facebook буде тобі показувати.', |
| app-mvp/src/data/adsSim.ts | 37 | { id: 'leads', label: 'Ліди', correct: true, feedback: 'Так. Facebook сам шукає людей, схильних лишити заявку — саме те, що потрібно зв\'язці.' }, |
| app-mvp/src/data/advice.ts | 1 | // «Мої цифри»: типи й аналіз кампанії за правилами курсу (модулі 05, 08). Орієнтири, а не закон Meta. |
| app-mvp/src/data/bm/index.ts | 14 | 'ads-manager': 'Ads Manager', |
| app-mvp/src/data/bm/index.ts | 15 | 'events-manager': 'Events Manager', |
| app-mvp/src/data/bm/index.ts | 17 | 'business-settings': 'Business Settings / Meta Business Suite', |
| app-mvp/src/data/bm/types.ts | 1 | // Дані для реальних скріншотів Business Manager з клікабельними зонами (не намальований макет). |
| app-mvp/src/data/bm/types.ts | 24 | section: string; // розділ Business Manager (ads-manager, events-manager, billing, business-settings...) — для навігаційного графа |
| app-mvp/src/data/phrases.ts | 65 | 'Facebook теж не з першого разу пристрілюється.', |
| app-mvp/src/data/pushTexts.ts | 12 | { title: 'Новий день, новий залив', body: 'Тільки спершу урок. Без бази ти просто спонсоруєш Facebook.' }, |
| app-mvp/src/data/quiz.ts | 138 | { emoji: '📷', title: 'Instagram', note: 'Скоро' }, |
| app-mvp/src/data/restricted.ts | 2 | // і суперечать політикам Meta (див. GRINDSET_export/07_IMPROVEMENTS.md, 08_MVP_SPEC.md). |
| app-mvp/src/version.ts | 15 | 'Шапка: «Арбітраж трафіку» замість «FB АРБІТРАЖ»; назви модулів 02 і 05 без назв продуктів', |
| app-mvp/src/version.ts | 16 | 'Дисклеймер «не повʼязаний з Meta Platforms, Inc.» на першому екрані та в Налаштування → Про застосунок', |

Окремо: `app-mvp/src/data/bm/adsmanager.ts` (каталог екранів карти кабінету): 53 рядків з назвами продуктів у заголовках і підказках екранів.

## 3. Контент (описові згадки, не чіпати)

| Файл | Рядків зі згадками |
|---|---|
| content/modules/grindset-module-05-expanded.md | 74 |
| content/modules/grindset-module-03-expanded.md | 71 |
| content/modules/grindset-module-09-expanded.md | 37 |
| app-mvp/src/data/module02.ts | 30 |
| content/modules/grindset-module-08-expanded.md | 23 |
| content/modules/grindset-module-06-expanded.md | 20 |
| content/modules/grindset-module-07-expanded.md | 18 |
| app-mvp/src/data/library.ts | 17 |
| app-mvp/src/data/lessons.ts | 16 |
| content/modules/grindset-module-04-expanded.md | 16 |
| app-mvp/src/data/glossary.ts | 6 |
| app-mvp/src/data/adsManagerTour.ts | 5 |
| content/modules/grindset-module-10-expanded.md | 4 |
| app-mvp/src/data/library.restricted.ts | 3 |
| app-mvp/src/data/glossary.restricted.ts | 1 |

`generated/` і `generated-public/` (з `content/modules/*.md`): 1018 рядків; змінюються лише через `.md`.

## 4. Метадані

- `app-mvp/app.json`: `name`, `slug`, `description`, `web.name`, `web.shortName`: без назв продуктів третіх сторін (перевіряється цим скриптом: якщо в `app.json` зʼявиться згадка, вона потрапить у розділ 2).
- Назва вкладки браузера й іконка застосунку: GRINDSET, власна ілюстрація.

## 5. Де видно логотипи Meta

- `app-mvp/assets/bm/adsmanager/*.png`: реальні знімки кабінету. Інтерфейс Meta на них видно цілком. Перевірено вручну: `campaigns-list.png` (логотип-«нескінченність» зліва вгорі, він є й на інших екранах із тією ж лівою панеллю Ads Manager) і `mbs-home.png` (напис «Meta Business Suite» у лівому верхньому куті, згадки Facebook/Instagram у тексті сторінки).
- `/adsim` і розділ «Карта кабінету» у Бібліотеці (`app-mvp/app/adsim.tsx`, `src/components/BmExplorer.tsx`): показують ці знімки як є. Окремий тренажер у `adsim.tsx` перемальований власними компонентами в палітрі, схожій на кабінет, без логотипів, але з текстами «Ads Manager» і «Facebook» у підказках.
- Решту знімків (список вище) на наявність логотипа окремо не перевіряв: вважати, що логотип або назва продукту є на кожному зі знімків ліворуч угорі.
- `app-mvp/assets/app-icon.png`: логотипів Meta немає (персонаж Гріндік на зеленому тлі).

Знімки в `app-mvp/assets/bm/adsmanager/` (36 файлів):

`ab-test-intro.png`, `ad-settings.png`, `ads-list.png`, `ads-reporting-gender.png`, `ads-reporting.png`, `adset-conversion.png`, `adsets-list.png`, `audiences-custom-source.png`, `audiences-empty.png`, `audiences-website-custom.png`, `automated-rules-create.png`, `automated-rules.png`, `billing-credit-lines.png`, `billing-invoices.png`, `billing-overview.png`, `billing-payment-activity.png`, `bs-ad-accounts.png`, `bs-domains.png`, `bs-instagram.png`, `bs-pages.png`, `campaign-objective.png`, `campaign-settings.png`, `campaigns-empty.png`, `campaigns-list.png`, `commerce-manager-overview.png`, `custom-conversions.png`, `events-overview.png`, `leads-center-welcome.png`, `main-nav-menu.png`, `mbs-all-tools.png`, `mbs-content-ad-posts.png`, `mbs-home.png`, `payment-methods.png`, `pixel-dataset-detail.png`, `pixel-setup.png`, `pixel-test-events.png`
