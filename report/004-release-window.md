# 004 · План вікна викладки кандидата b26

**Кандидат:** гілка `tester-update`, коміт `7490379` (`release: candidate b26`). Не запушено.
**Статус плану:** нічого не виконано. Виконується лише після погодження власника, одним коротким вікном (ціль — 15–20 хвилин від кроку 2 до кроку 4).
**Де відрепетирувано:** локальний Postgres, `supabase/sqltest/rehearsal.test.ts` — копія → 0007 → нова збірка → v2 → 0008 → відкат → повернення, без втрат уроків, нагород і відгуків (30 з 30 SQL-тестів).

**Ролі:** **В** — власник (доступ до Supabase, Vercel, GitHub, Telegram). **CC** — Claude Code (готує команди, перевіряє виводи, які власник вставляє в чат без ключів). Ключі й токени в чат не вставляються.

**Що бачать тестери в цілому:** до кроку 3 — стара збірка b24, усе працює як раніше. Після кроку 3 — b26 (вісім вертикалей, «Ліди», карта, «Продовжити», відгуки). Між кроками 3 і 4 уроки зараховуються на пристрої й доходять на сервер після кроку 4 — тому вікно між ними тримаємо хвилинами.

---

## 0. Перед вікном (за день)

| Що | Хто | Перевірка |
|---|---|---|
| Повідомити тестерів: «завтра о ЧЧ:ММ коротке оновлення на 15 хвилин, не проходьте уроки в цей час» | В | — |
| Звірити схему продакшна з локальною: SQL Editor → `report/004-prod-schema-query.sql` (лише читання) → результат зберегти як `research/prod-schema.json` (без рядків даних) | В → CC | CC: `node supabase/sqltest/schema-check.mjs research/prod-schema.json` (немає даних і секретів) і `node --no-warnings supabase/sqltest/schema-compare.ts research/prod-schema.json 6` — розбіжностей із 0001–0006 немає |
| У Vercel → Settings → Git підтвердити, з якої гілки йде продакшн-деплой, і де кнопка «Instant Rollback» | В | назва гілки записана в цей файл |

## 1. Резервна копія

| Дія | Хто | Перевірка після кроку | Що бачить тестер |
|---|---|---|---|
| Supabase → Database → Backups: переконатися, що є свіжа щоденна копія (дата сьогодні). Додатково — вивантаження таблиць: Table editor → `allowed_users`, `progress`, `events`, `feedback` → Export CSV. Файли — у приватну папку власника поза репозиторієм (не в `GRINDSET`, не в git) | В | є 4 файли CSV і дата копії |
| SQL Editor (лише читання), зберегти результат як `report/004-backup-counts.txt`: `select 'allowed_users' t, count(*) n, md5(string_agg(to_jsonb(x)::text, '' order by id)) h from public.allowed_users x union all select 'progress', count(*), md5(string_agg(to_jsonb(x)::text, '' order by user_id)) from public.progress x union all select 'events', count(*), md5(string_agg(to_jsonb(x)::text, '' order by id)) from public.events x union all select 'feedback', count(*), md5(string_agg(to_jsonb(x)::text, '' order by id)) from public.feedback x;` | В → CC | CC зберігає числа рядків і суми як точку відліку | нічого |

## 2. Міграція 0007 — режим `legacy`

| Дія | Хто | Перевірка | Що бачить тестер |
|---|---|---|---|
| SQL Editor → New query → увесь файл `supabase/migrations/0007_progress_v2.sql` з гілки (не копія з `report/003-…`, вона застаріла) → Run | В | `select mode from public.progress_settings;` → `legacy`; `select count(*) from public.progress where rev is null;` → 0; кількість рядків `progress` = копія | стара збірка b24 зберігає як раніше, із захистом від затирання |

## 3. Клієнт b26

| Дія | Хто | Перевірка | Що бачить тестер |
|---|---|---|---|
| `git push origin tester-update` (запускає preview-збірку Vercel) | В (або CC за окремим дозволом) | preview-збірка зелена; на preview-URL `/version.json` → `{"build":26,…}` | нічого |
| Злиття `tester-update` у продакшн-гілку (див. крок 0) і продакшн-деплой | **В** | Vercel → Deployments: продакшн з комітом `7490379`; `https://<домен>/version.json` → `build 26` | після відкриття Mini App: оновлення до b26 (кеш скидається за `version.json`) |
| Відкрити застосунок через чинного бота на телефоні й у Telegram Desktop | В | вхід працює; головна — «Обери вертикаль»; у профілі збірка 26 | b26 |

Між кроками 3 і 4: b26 відповідає `not_active`, уроки лишаються в черзі на пристрої (не губляться). Не робити паузи.

## 4. Перемикання `set_progress_write_mode('v2')`

| Дія | Хто | Перевірка | Що бачить тестер |
|---|---|---|---|
| SQL Editor: `select public.set_progress_write_mode('v2');` | В | відповідь `changed: true`; `select mode from public.progress_settings;` → `v2`; через 1–2 хв `select count(*) from public.progress_ops;` росте, коли тестери заходять | уроки з черги доходять на сервер; стара збірка (якщо в когось лишилась) нічого не пише й показує подію `client_outdated` |

## 5. Міграція 0008 — відгуки

| Дія | Хто | Перевірка | Що бачить тестер |
|---|---|---|---|
| SQL Editor → увесь файл `supabase/migrations/0008_feedback_queue.sql` → Run | В | `select count(*) from public.feedback;` = копія (плюс нові); `select * from public.admin_feedback_queue() limit 1;` від адміна працює; у адмінці помітки й статус «в черзі для Claude» зберігаються | відгук — коментар / пропозиція / баг з контекстом. До цього кроку b26 пише відгук старим форматом, нічого не губиться |

## 6. Димова перевірка через чинного бота

| Дія | Хто | Перевірка |
|---|---|---|
| Телефон: вхід → вертикаль → урок → результат; закрити Mini App → відкрити → «Продовжити» | В | урок зараховано, після повторного відкриття він на місці |
| Telegram Desktop тим самим тестером | В | той самий прогрес і «Продовжити» |
| Відгук з уроку | В | в адмінці видно екран, урок і крок |
| SQL: числа рядків з кроку 1 | CC | `allowed_users` без змін; `progress` не менше; `events`, `feedback` не менше |

## 7. Моніторинг 48 годин

CC готує запити, В запускає двічі на день і вставляє результат у чат.

```sql
-- стара збірка після перемикання (має згаснути за добу)
select username, count(*), max(created_at) from public.events where name = 'client_outdated' and created_at > now() - interval '12 hours' group by 1;
-- помилки синхронізації і застряглі черги
select name, props->>'code' code, count(*), count(distinct user_id) users from public.events where name in ('sync_error', 'sync_queue_stale') and created_at > now() - interval '12 hours' group by 1, 2;
-- підсумки операцій: відхилені й непропущені
select status, count(*) from public.progress_ops where created_at > now() - interval '12 hours' group by 1;
-- зменшення прогресу відносно копії (CC звіряє з report/004-backup-counts і CSV копії)
select user_id, jsonb_array_length(core->'completed') lessons, (core->>'xp')::int xp from public.progress order by 1;
```

## 8. Признаки зупинки й відкату

Відкат, якщо хоч одне:
- будь-який тестер втратив урок (менше уроків, ніж у копії);
- масові `sync_error` (більше ніж у 2 тестерів за годину);
- `client_outdated` у збірки 26;
- помилка входу в b26.

## 9. Відкат

| Дія | Хто | Перевірка |
|---|---|---|
| `select public.set_progress_write_mode('legacy');` | В | `mode = legacy` |
| Vercel → Deployments → попередній продакшн-деплой (b24) → Instant Rollback | В | `/version.json` → `build 24` |
| 0008 лишається (аддитивна, стара збірка її не помічає) | — | — |
| Перевірка даних: записи після міграції лишаються в `progress.state` і журналі `progress_ops`; CC звіряє числа з копією | CC | жоден урок не втрачено (так само, як у репетиції) |

**Повернення вперед** після виправлення: новий деплой → `set_progress_write_mode('v2')`. Уроки, пройдені в режимі відкату старою збіркою, підхоплюються в ядро (перевірено репетицією, кроки 6–7). Після повернення — ті самі запити кроку 6.

## 10. Репозиторій у private

Після деплою повного оновлення, за рішенням власника: GitHub → Settings → Danger Zone → Change visibility → Private. Vercel-проєкт лишається підключеним (перевірити, що наступний push збирається).
