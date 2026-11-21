# 004 / 007 · План одного вікна викладки кандидата b28 (зі скиданням тестерів)

**Кандидат:** гілка `tester-update`, збірка **b28**. Остаточний SHA — у `report/007-reset-backup-b28.md` (розділ «Кандидат»). Не запушено.

**Статус плану (18.11.2026): ВИКОНАНО в задачі 008 зі збіркою b29 (`18a27d6`)** — підсумок і числа в `report/008-window-b29.md`. Відмінності від цього плану: одразу після 0007 застосовано 0010 (службові учітки поза рейтингом); `preview_check` позначено `is_service`; SQL-файли міграцій вставлялись у SQL Editor із локального файла зі звіркою SHA-256 з репозиторієм; колонка режиму — `write_mode` (виправлено нижче).

**Статус до виконання:** виконується лише після погодження власника, одним вікном. Ціль — 30–40 хвилин від кроку 2 до кроку 9. Скидання (крок 9) — **окрема команда власника** зі списком, який він затвердив.

**Де відрепетирувано.** Локальний Postgres із типовими правами Supabase:
- `supabase/sqltest/rehearsal.test.ts`: копія → 0007 → нова збірка → v2 → 0008 → відкат → повернення → 0009 → скидання за списком → архів = видаленому → відновлення одної учётки;
- `backup.test.ts`: копія тим самим запитом → відновлення на ізольованій базі → повний відкат даних;
- `reset.test.ts`: R1–R11 і права.

Усього 48 SQL-тестів.

**Ролі:**
- **В** — власник: Supabase, Vercel, GitHub, Telegram.
- **CC** — Claude Code: готує команди й перевіряє виводи, які власник вставляє в чат без ключів і паролів.

**Продакшн-гілка Vercel — `grindyk-real-renders`.** Змінні `EXPO_PUBLIC_*` діють і для Preview, тож **preview працює з продакшн-базою**. Перевіряти його лише **окремою тестовою учёткою** (див. «Підготовка»). Вхід учёткою тестера чи власника на preview витісняє єдиний активний сеанс на його телефоні.

---

## Підготовка (за день)

| Що | Хто | Де | Перевірка |
|---|---|---|---|
| Повідомити тестерів: «завтра о ЧЧ:ММ оновлення на ~40 хвилин; після нього прогрес почнеться з нуля» | В | Telegram | — |
| Окрема тестова учётка для preview (напр. `preview_check`): адмінка застосунку → «Тестери» → додати → видати код. Код зберегти собі, не в чат | В | застосунок `/admin` | учётка є в списку, статус «запрошено» |
| Затвердити список учёток для скидання: SQL Editor → `report/007-reset-candidates.sql` (лише читання) → вирішити, кого скидати (свою учётку — на твій розсуд), записати id | В | Supabase SQL Editor | список id записано: ________ |
| Звірка схеми продакшна: зроблено 18.11 (`report/007-reset-backup-b28.md`, точка 0) — структура збігається з 0001–0006 | CC | — | — |

## 1. Резервна копія — без неї вікно не починається

| Дія | Хто | Що бачить тестер | Ознаки зупинки | Відкат |
|---|---|---|---|---|
| Папка `C:\Users\murak\GRINDSET-backups\<дата>\`. SQL Editor → увесь `report/007-backup-export.sql` → Run → Export → **Download CSV** → `backup.csv`. Там само `supabase/sqltest/schema-dump.sql` → клітинку в `prod-schema.json` | В | нічого | запит із помилкою; файл порожній | — (нічого не змінено) |
| Перевірка копії: `node --no-warnings supabase/sqltest/backup-restore.ts <папка>\backup.csv --schema <папка>\prod-schema.json --emit-rollback <папка>\rollback.sql` | CC (за командою) або В | нічого | будь-що, крім «КОПІЯ ПРИДАТНА» (кількість / md5 / структура / вхід) → **стоп, вікно не починається** | — |
| Записати числа рядків і суми з виводу як точку відліку | CC | нічого | — | — |

## 2. Міграція 0007 — режим `legacy`

| Дія | Хто | Що бачить тестер | Ознаки зупинки | Відкат |
|---|---|---|---|---|
| SQL Editor → увесь `supabase/migrations/0007_progress_v2.sql` з гілки → Run. Перевірка: `select has_function_privilege('authenticated', 'public.revoke_user_sessions(uuid)', 'execute');` → `false` (зайве типове право Supabase закрито вже тут) | В | b24 працює як раніше (із захистом від затирання) | помилка міграції; `select write_mode from public.progress_settings` ≠ `legacy`; рядків `progress` менше, ніж у копії | міграція аддитивна: старі збірки її не помічають; дані — з копії (повний відкат, кінець плану) |

## 3. Push і preview — лише тестовою учёткою

| Дія | Хто | Що бачить тестер | Ознаки зупинки | Відкат |
|---|---|---|---|---|
| `git push origin tester-update` → Vercel будує preview | В (або CC за окремим дозволом) | нічого (продакшн — b24) | збірка червона | не зливати; виправлення окремо |
| Preview-URL: `/version.json` → `{"build":28,…}`; вхід **учёткою `preview_check`** → головна «Обери вертикаль» → один урок → результат; `/kb/MET-06` після входу відкриває статтю | В | нічого | помилка входу; урок не зараховано | не зливати |

## 4. Злиття в `grindyk-real-renders` і продакшн-деплой b28

| Дія | Хто | Що бачить тестер | Ознаки зупинки | Відкат |
|---|---|---|---|---|
| Злиття `tester-update` → `grindyk-real-renders`; Vercel → Deployments: продакшн з остаточним SHA кандидата; `https://trafik-lab.vercel.app/version.json` → `build 28` | **В** | після відкриття Mini App — оновлення до b28 (кеш скидається за `version.json`); прогрес поки старий; уроки до кроку 5 лишаються в черзі на пристрої | `client_outdated` у збірки 28; помилка входу | Vercel → Deployments → попередній продакшн (b24) → **Instant Rollback** |

## 5. Перемикання `set_progress_write_mode('v2')`

| Дія | Хто | Що бачить тестер | Ознаки зупинки | Відкат |
|---|---|---|---|---|
| SQL Editor: `select public.set_progress_write_mode('v2');` → `changed: true`; `select write_mode from public.progress_settings` → `v2` | В | уроки з черги доходять на сервер; стара збірка нічого не пише (`client_outdated`) | масові `sync_error`; рядків `progress` менше, ніж у копії | `select public.set_progress_write_mode('legacy');` + Instant Rollback на b24 |

## 6. Міграція 0008 — відгуки

| Дія | Хто | Що бачить тестер | Ознаки зупинки | Відкат |
|---|---|---|---|---|
| SQL Editor → увесь `supabase/migrations/0008_feedback_queue.sql` → Run; `select count(*) from public.feedback` = копія + нові; `select * from public.admin_feedback_queue() limit 1` від адміна | В | відгук — коментар / пропозиція / баг із контекстом | кількість відгуків менша за копію | 0008 аддитивна, лишається; дані — з копії |

## 7. Міграція 0009 — епоха й архів

| Дія | Хто | Що бачить тестер | Ознаки зупинки | Відкат |
|---|---|---|---|---|
| SQL Editor → увесь `supabase/migrations/0009_progress_epoch_reset.sql` → Run. Перевірка прав: `select has_function_privilege('authenticated', 'public.reset_progress(text, uuid[])', 'execute'), has_function_privilege('authenticated', 'public.revoke_user_sessions(uuid)', 'execute');` → `false, false` | В | нічого (епоха 0, усі пишуть як раніше) | помилка міграції; будь-яке `true` у перевірці прав | 0009 аддитивна; без скидання нічого не змінює |

## 8. Повторна перевірка перед скиданням

| Дія | Хто | Що бачить тестер | Ознаки зупинки | Відкат |
|---|---|---|---|---|
| SQL Editor → `report/007-reset-candidates.sql` (лише читання): список і обсяг прогресу; звірити з затвердженим списком | В → CC | нічого | список не збігається з затвердженим | не скидати |

## 9. Скидання за затвердженим списком — **окрема команда власника**

| Дія | Хто | Що бачить тестер | Ознаки зупинки | Відкат |
|---|---|---|---|---|
| SQL Editor: `select public.reset_progress('window-<дата>', array['<id 1>', '<id 2>', …]::uuid[]);` — результат (по кожній учётці: заархівовано / видалено) вставити в чат | **В** | після відкриття Mini App — **чистий старт**: онбординг, вибір персонажа, прогрес з нуля. Другий пристрій зі старим прогресом очищується й теж стартує з нуля. Вхід без нового коду | помилка; у результаті `archived_progress ≠ deleted_progress` чи `archived_ops ≠ deleted_ops`; учётка поза списком у результаті | **одна учётка:** `select public.restore_progress('window-<дата>', '<id>'::uuid);` — прогрес з архіву з новою епохою, пристрої учётки очистяться й завантажать відновлене; **повтор** `reset_progress` з тим самим id нічого не робить |

## 10. Перевірка числа рядків і архіву

| Дія | Хто | Перевірка |
|---|---|---|
| SQL Editor (лише читання): `select run_id, kind, count(*) from public.progress_archive group by 1, 2;` і `select count(*) from public.progress;` | В → CC | у архіві `progress` = кількості скинутих учёток із прогресом; `op` = видаленим операціям; `progress` = копія − скинуті (+ нові записи учёток поза списком) |
| Учётки, відгуки, помітки, події | CC | `allowed_users` = копія (за кількістю); `feedback` ≥ копії; `events` ≥ копії; `feedback_review` на місці |

## 11. Димова перевірка через чинного бота

| Дія | Хто | Перевірка |
|---|---|---|
| Телефон учёткою зі списку: відкрити Mini App → чистий старт (R1) → онбординг → урок → результат → закрити → відкрити → «Продовжити» | В | новий прогрес зараховано |
| Telegram Desktop тією самою учёткою (там був старий прогрес): відкрити → чистий старт, старе не повернулось (R2) | В | на сервері нічого старого (`select count(*) from public.progress_ops where user_id = '<id>'` — лише нові) |
| Якщо в когось лишилась b24: відкрити → вона нічого не записує (R4) | В | `client_outdated` у подіях, прогресу зі старого не зʼявилось |
| Відгук з уроку | В | в адмінці видно екран, урок і крок |

## 12. Моніторинг 48 годин

CC готує запити, В запускає двічі на день і вставляє результат у чат.

```sql
-- стара збірка після перемикання (має згаснути за добу)
select username, count(*), max(created_at) from public.events where name = 'client_outdated' and created_at > now() - interval '12 hours' group by 1;
-- помилки синхронізації, застряглі черги, очищення після скидання (epoch_reset — очікувано по разу на пристрій скинутої учётки)
select name, props->>'code' code, count(*), count(distinct user_id) users from public.events where name in ('sync_error', 'sync_queue_stale') and created_at > now() - interval '12 hours' group by 1, 2;
-- підсумки операцій (rejected_epoch — перенесення старих даних після скидання; не повинно рости)
select status, count(*) from public.progress_ops where created_at > now() - interval '12 hours' group by 1;
-- прогрес після скидання
select a.username, a.progress_epoch, coalesce(jsonb_array_length(p.core->'completed'), 0) lessons from public.allowed_users a left join public.progress p on p.user_id = a.id order by 1;
-- відгуки з b28
select build, kind, count(*), count(branch) with_branch from public.feedback where created_at > now() - interval '12 hours' group by 1, 2;
```

## Ознаки зупинки й відкату (будь-яка)

- учётка **поза списком** втратила прогрес;
- скинута учётка після відкриття отримала старий прогрес назад;
- масові `sync_error` (більше ніж у 2 тестерів за годину), крім `epoch_reset`;
- `client_outdated` у збірки 28;
- помилка входу в b28;
- «Ліди» зараховано без обовʼязкових критеріїв або не зараховано після них.

## Відкат

| Ситуація | Дія | Хто |
|---|---|---|
| Проблема клієнта b28 | `select public.set_progress_write_mode('legacy');` → Vercel Instant Rollback на b24. Прогрес скинутих учёток у b24 після цього **не зберігається** (захист від повернення старого), до повернення в v2 | В |
| Одна учётка скинута помилково | `select public.restore_progress('window-<дата>', '<id>'::uuid);` | В |
| Повний відкат даних до стану перед вікном | SQL Editor → увесь `<папка копії>\rollback.sql` (згенерований на кроці 1, лише з приватної папки) → Run; потім `select public.set_progress_write_mode('legacy');` і Instant Rollback на b24. Перевірка: `backup-restore.ts` / запит сум із копії — числа рядків і md5 як у кроці 1 | В → CC |
| Повернення вперед після виправлення | новий деплой → `set_progress_write_mode('v2')`; скидання вдруге не потрібне (епохи збережено), той самий `run_id` нічого не повторить | В |

## Репозиторій у private

Після вікна, за рішенням власника: GitHub → Settings → Danger Zone → Change visibility → Private. Перевірити, що наступний push збирається у Vercel.

---

## Дії власника (усе в одному місці)

| # | Коли | Що | Де |
|---|---|---|---|
| 1 | за день | Повідомити тестерів про вікно й скидання | Telegram |
| 2 | за день | Тестова учётка `preview_check` і код для неї | застосунок → `/admin` → «Тестери» |
| 3 | за день | Список учёток для скидання (id) за `report/007-reset-candidates.sql` | Supabase → SQL Editor |
| 4 | крок 1 | Копія: `report/007-backup-export.sql` → `backup.csv`, `schema-dump.sql` → `prod-schema.json` у `C:\Users\murak\GRINDSET-backups\<дата>\` | Supabase → SQL Editor; Провідник |
| 5 | крок 1 | Команда «перевір копію» (CC запускає `backup-restore.ts`) або запуск самостійно | чат / PowerShell |
| 6 | крок 2 | 0007 | Supabase → SQL Editor |
| 7 | крок 3 | Дозвіл на push (або push самостійно); перевірка preview учёткою `preview_check` | чат; браузер |
| 8 | крок 4 | Злиття в `grindyk-real-renders`, продакшн-деплой | GitHub; Vercel → Deployments |
| 9 | кроки 5–7 | `set_progress_write_mode('v2')`, 0008, 0009 | Supabase → SQL Editor |
| 10 | крок 9 | **Команда скидання** `reset_progress(...)` зі своїм списком | Supabase → SQL Editor |
| 11 | кроки 10–11 | Запити перевірки; димова перевірка на телефоні й у Telegram Desktop (R1, R2, R4) | Supabase → SQL Editor; Telegram |
| 12 | 48 год | Запити моніторингу двічі на день, результат — у чат | Supabase → SQL Editor |
