# 008 · Вікно викладки b29: вхід через Telegram, міграції, скидання прогресу

**Дата:** 18.11.2026. **Виконано повністю**, ознак зупинки з плану не було.

## Підсумок

| Що | Результат |
|---|---|
| SHA на продакшні | `18a27d6` (гілка `grindyk-real-renders`, fast-forward з `tester-update`, без force) |
| Збірка на продакшні | **b29**: `https://trafik-lab.vercel.app/version.json` → `{"build":29}` |
| Міграції | 0007 → 0010 → (деплой b29) → `v2` → 0008 → 0009. Перед кожною SHA-256 файла в SQL Editor звірено з репозиторієм |
| Скидання | 21 тестер (разом із власником) — `window-2026-11-18`; `preview_check` — окремо, `window-2026-11-18-svc` |
| Приватна копія | `C:\Users\murak\GRINDSET-backups\2026-11-18\` (поза Git): `backup.csv`, `prod-schema.json`, `rollback.sql`, `reset-list.md`, `reset-command.sql`, `preview_check-code.csv` |

## 1. Вхід через Telegram (кандидат b29)

- **Сервер уже готовий.** Розгорнутий `invite-login` (02.11) збігається з `supabase/functions/invite-login/index.ts` байт у байт (SHA-256). Секрет `TELEGRAM_BOT_TOKEN` є (перевірено лише назву). Підроблені дані Telegram продакшн відхиляє: `403 wrong`. Без токена було б `503`.
- **Сценарій:** кнопка в боті → підпис initData → пошук за `telegram_id` → вхід без коду. Привʼязка одноразова й лише з правильним кодом, збіг ніка нічого не дає. Права адміна й білий список не змінюються. Покрито тестом `supabase/tests/login008.test.ts`, 10/10: справжній обробник, підписані initData.
- **Зміни клієнта в b29:**
  - «вхід з іншого пристрою» в Mini App → кнопка «Увійти через Telegram» (без коду, лише вручну);
  - недійсний підпис → «Не вдалося підтвердити Telegram» (а не «нік або код не збігаються»);
  - немає привʼязки → пояснення для запрошених і для тих, у кого запрошення немає;
  - **виправлено:** після переходу між екранами адреса втрачає `tgWebAppData`, тож будь-яке перезавантаження в Mini App (зокрема оновлення збірки) вимикало автоматичний вхід. Тепер Telegram-скрипт вантажиться за параметрами, які він сам зберіг у `sessionStorage`.
- **Перевірки кандидата:** `test:cloud` 154 + витік (повна 2/2, публічна 3/3), SQL 51/51, `tsc` чистий. Перевірка безпеки — без знахідок (`report/008-security.md`). Знімки екранів — `report/008-screens/`.
- **Стан привʼязок на продакшні:** 2 з 21 учіток привʼязані до Telegram. Решта 19 один раз введуть нік і код у Mini App, далі входитимуть без коду.

## 2. Резервна копія

- Експорт шести таблиць і знімок структури — у SQL Editor, лише читання; файли у приватній папці.
- Перевірка на ізольованій локальній базі: **«КОПІЯ ПРИДАТНА»**. Кількість і md5 збігаються в усіх таблицях: allowed_users 21, progress 12, events 82, feedback 1, keepalive 1, login_throttle 27. Функції, права, політики й тригери збігаються зі знімком. Вхід і завантаження прогресу працюють для 13 з 13 учіток.
- SQL повного відкату — `rollback.sql` у тій самій папці.

## 3. Кроки вікна

| Крок | Перевірка після |
|---|---|
| 0007 | `write_mode = legacy`; `revoke_user_sessions` для `authenticated` закрито; рядків progress 12 (= копія) |
| 0010 | є поле `is_service`; `leaderboard_accuracy()` виключає службові учітки; для `anon` закрито |
| `preview_check` | створено зі статусом `invited` і `is_service = true`; код видано одразу в CSV у приватну папку (на екран не читався) |
| push `tester-update` → preview | `version.json` = 29. Під `preview_check`: вхід (підтверджено в базі), онбординг, урок 1 «Товарка» (2/2), відгук (b29, екран результатів, урок BR-TOV-L01), події |
| злиття → продакшн | `trafik-lab.vercel.app/version.json` = 29; виправлення Telegram в `index.html` на місці |
| `set_progress_write_mode('v2')` | `write_mode = v2`, запис у журналі режимів; урок `preview_check` із черги дійшов на сервер (синхронізація працює) |
| 0008 | `feedback_review`, `admin_feedback_queue()`, `admin_contributors()`, колонка `branch`; права: `anon` — ні; відгуків 2 (≥ копії) |
| 0009 | права `reset_progress` / `restore_progress` / `revoke_user_sessions` для `authenticated` і `anon` — `false`; захист старої збірки в `save_progress` є; архів створено; епохи 0 |
| звірка списку | у базі 21 тестер; md5 відсортованих ID = список у `reset-list.md`; заблокованих немає |

## 4. Скидання

| | До | Після |
|---|---|---|
| Учітки | 22 (21 + `preview_check`) | 22 |
| Прогрес тестерів | 12 рядків | **0** |
| Архів `progress_archive` | 0 | **progress: 12** (тестери) + 1 і операції 3 (`preview_check`, окремий запуск) |
| Операції тестерів | 0 | 0 |
| Епоха | 0 | **1** в усіх 21 тестера і в `preview_check` |
| Відгуки / помітки / події | 2 / 0 / 91 | 2 / 0 / 91 |
| Привʼязки Telegram / адміни | 2 / 1 | 2 / 1 |
| Активні сеанси | 14 | 14 (повторний вхід не потрібен) |

- Результат запуску `window-2026-11-18`: 21 учітка, у кожної «заархівовано = видалено», разом 12 рядків прогресу, 0 операцій. Виконав `postgres`.
- **Чистий старт і захист від повернення старого прогресу** (на `preview_check`): після скидання в браузері лишався локальний урок. Відкриття застосунку → локальний прогрес очищено → онбординг без повторного входу. На сервері нічого старого: прогрес 0, операцій 0, `sync_error` 0. Новий урок після цього записався з епохою 1: 1 урок, операції `applied`.

## 5. Що пройти в Telegram (власник)

| # | Що | Очікування |
|---|---|---|
| T1 | Телефон, твоя учітка (вже привʼязана): кнопка в боті Гріндіка | Mini App оновлюється до b29 і відкривається **без коду**; чистий старт: онбординг, вибір образу, прогрес з нуля |
| T2 | Пройти урок → закрити → відкрити | урок зараховано, «Продовжити» веде далі |
| T3 | Telegram Desktop тією самою учіткою | вхід без коду; на телефоні при поверненні — «Вхід виконано з іншого пристрою» і кнопка **«Увійти через Telegram»** (натиснути → вхід без коду) |
| T4 | Desktop: старого прогресу немає (там був прогрес до скидання) | чистий старт, на сервері лише нове |
| T5 | BotFather → бот → Menu Button / Web App URL | `https://trafik-lab.vercel.app` (не preview, не стара адреса) |
| T6 | Тестер без привʼязки (будь-хто з 19) | один раз нік + код → далі вхід без коду |
| T7 | Повідомити тестерів | «Оновлення b29: прогрес почався з нуля (так задумано). Відкривайте застосунок кнопкою в боті» |

Реальний вхід через Telegram у цьому вікні не імітувався: його перевіряють лише T1–T4.

## 6. Моніторинг на 2 дні (SQL Editor, двічі на день, лише читання)

```sql
-- 1. Вхід і привʼязка Telegram: хто заходив за 12 год і скільки вже привʼязано
select count(*) filter (where last_login_at > now() - interval '12 hours') as logins_12h,
       count(*) filter (where telegram_id is not null) as tg_linked,
       count(*) filter (where status = 'blocked') as blocked
  from public.allowed_users where not is_service;

-- 2. Помилки синхронізації й застряглі черги (у кількох тестерів одночасно — ознака проблеми)
select name, props->>'code' as code, count(*), count(distinct user_id) as users
  from public.events
 where name in ('sync_error', 'sync_queue_stale', 'client_outdated') and created_at > now() - interval '12 hours'
 group by 1, 2 order by 3 desc;

-- 3. Операції прогресу: rejected_epoch (перенесення старого після скидання) не має рости
select status, count(*) from public.progress_ops where created_at > now() - interval '12 hours' group by 1;

-- 4. Прогрес після скидання: у тестерів лише епоха 1, уроки ростуть з нуля
select a.progress_epoch, count(*) as users, count(p.user_id) as with_progress,
       coalesce(sum(jsonb_array_length(p.core->'completed')), 0) as lessons
  from public.allowed_users a left join public.progress p on p.user_id = a.id
 where not a.is_service group by 1;

-- 5. Архів не змінюється (12 + 1 progress, 3 op) і повторних запусків немає
select run_id, kind, count(*) from public.progress_archive group by 1, 2 order by 1, 2;
select run_id, action, created_at from public.progress_reset_runs order by created_at;

-- 6. Відгуки з b29 і рейтинг без службових учіток
select build, kind, count(*), count(branch) as with_branch from public.feedback where created_at > now() - interval '12 hours' group by 1, 2;
select count(*) from public.progress p join public.allowed_users a on a.id = p.user_id where a.is_service and p.answers_total >= 10; -- має бути 0 або учітка поза рейтингом
```

**Ознаки, за якими потрібне втручання (будь-яка):**
- скинута учітка отримала старий прогрес назад: у запиті 4 є `progress_epoch = 0` або уроки зʼявились без входу;
- `sync_error` більше ніж у 2 тестерів за годину; `client_outdated` від збірки 29;
- `rejected_epoch` росте впродовж доби (хтось тримає стару збірку чи старі дані);
- тестер пише, що Mini App просить код, хоча Telegram привʼязаний, або «Не вдалося підтвердити Telegram» повторюється після відкриття кнопкою в боті;
- рядків у `progress_archive` стало більше, ніж 13 / 3, без твого рішення.

## 7. Відкат (обмеження b24 прийнято)

- Проблема клієнта b29: пауза навчання й повідомлення тестерам → `select public.set_progress_write_mode('legacy');` → Vercel Instant Rollback на b24. Прогрес скинутих учіток у b24 не зберігається, доки не повернемось у `v2`.
- Повернення прогресу з архіву — лише окремим рішенням: `select public.restore_progress('window-2026-11-18', '<id>'::uuid);`. ID — у приватному `reset-list.md`.
- Повний відкат даних до стану перед вікном — `rollback.sql` з приватної папки (див. `report/004-release-window.md`, розділ «Відкат»).

## 8. Примітки

- Chrome «заморожує» вкладки згорнутого вікна, і розширення до них не дістається. Через це вікно двічі зупинялось. Для наступних вікон вікно Chrome має лишатись розгорнутим.
- Оновлено план: `report/004-release-window.md` — колонка `write_mode` (було `mode`), статус «виконано в 008».
