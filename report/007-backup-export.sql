-- ============================================================================
-- 007 · Резервна копія даних продакшна перед вікном (ТЗ 007, п. 2). ЛИШЕ ЧИТАННЯ: нічого не змінює.
-- Де: Supabase → SQL Editor → New query → вставити ВЕСЬ файл → Run.
-- Результат: один рядок, колонка backup (JSON): усі рядки шести таблиць public, кількість рядків і контрольні суми.
-- Збереження: над результатом «Export» → «Download CSV» (або «Copy as JSON») → файл у ПРИВАТНУ папку поза репозиторієм:
--   C:\Users\murak\GRINDSET-backups\<дата>\backup.csv
-- Структура, функції, тригери, політики й права — у знімку prod-schema.json (той самий запит, що й для звірки), покладіть поруч:
--   C:\Users\murak\GRINDSET-backups\<дата>\prod-schema.json
-- Перевірка копії (без доступу до продакшна, на ізольованій локальній базі):
--   node --no-warnings supabase/sqltest/backup-restore.ts C:\Users\murak\GRINDSET-backups\<дата>\backup.csv
-- Таблиці — фактичний список продакшна зі знімка 18.11: allowed_users, progress, events, feedback, keepalive, login_throttle.
-- Якщо копія робиться ПІСЛЯ 0007 / 0008 / 0009, розкоментуйте відповідні рядки нижче (журнал операцій, режим, помітки, архів).
-- ============================================================================
set timezone to 'UTC';
select json_build_object(
  'format', 'grindset-backup-v1',
  'exported_at', now(),
  'tables', json_build_object(
    'allowed_users',  (select coalesce(json_agg(t order by t.id), '[]'::json) from public.allowed_users t),
    'progress',       (select coalesce(json_agg(t order by t.user_id), '[]'::json) from public.progress t),
    'events',         (select coalesce(json_agg(t order by t.id), '[]'::json) from public.events t),
    'feedback',       (select coalesce(json_agg(t order by t.id), '[]'::json) from public.feedback t),
    'keepalive',      (select coalesce(json_agg(t order by t.id), '[]'::json) from public.keepalive t),
    'login_throttle', (select coalesce(json_agg(t order by t.key), '[]'::json) from public.login_throttle t)
    -- , 'progress_ops',      (select coalesce(json_agg(t order by t.user_id, t.op_id), '[]'::json) from public.progress_ops t)
    -- , 'progress_settings', (select coalesce(json_agg(t), '[]'::json) from public.progress_settings t)
    -- , 'progress_mode_log', (select coalesce(json_agg(t order by t.id), '[]'::json) from public.progress_mode_log t)
    -- , 'feedback_review',   (select coalesce(json_agg(t order by t.feedback_id), '[]'::json) from public.feedback_review t)
  ),
  'counts', json_build_object(
    'allowed_users',  (select count(*) from public.allowed_users),
    'progress',       (select count(*) from public.progress),
    'events',         (select count(*) from public.events),
    'feedback',       (select count(*) from public.feedback),
    'keepalive',      (select count(*) from public.keepalive),
    'login_throttle', (select count(*) from public.login_throttle)
  ),
  -- контрольні суми: md5 від рядків у фіксованому порядку (той самий вираз у плані вікна, крок 1)
  'md5', json_build_object(
    'allowed_users',  (select md5(coalesce(string_agg(to_jsonb(x)::text, '' order by id), '')) from public.allowed_users x),
    'progress',       (select md5(coalesce(string_agg(to_jsonb(x)::text, '' order by user_id), '')) from public.progress x),
    'events',         (select md5(coalesce(string_agg(to_jsonb(x)::text, '' order by id), '')) from public.events x),
    'feedback',       (select md5(coalesce(string_agg(to_jsonb(x)::text, '' order by id), '')) from public.feedback x),
    'keepalive',      (select md5(coalesce(string_agg(to_jsonb(x)::text, '' order by id), '')) from public.keepalive x),
    'login_throttle', (select md5(coalesce(string_agg(to_jsonb(x)::text, '' order by key), '')) from public.login_throttle x)
  )
)::text as backup;
