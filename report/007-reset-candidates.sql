-- ============================================================================
-- 007 · Кандидати на скидання прогресу (ТЗ 005). ЛИШЕ ЧИТАННЯ. Нічого не змінює.
-- Де: Supabase → SQL Editor → New query → вставити → Run. Виконує власник у вікні, після кроку 0009.
-- Ті самі учётки, що й admin_testers(), з позначкою адміна й обсягом прогресу (SQL Editor не має сеансу застосунку,
-- тому читаємо таблицю напряму). Хеші кодів, Telegram id і сеанси не виводяться.
-- Остаточний список (id) затверджує власник; чи включати власну учётку — вирішує він.
-- ============================================================================
select a.id,
       a.username,
       a.display_name,
       a.status,
       a.is_admin,
       a.last_login_at,
       coalesce(a.progress_epoch, 0)                                as epoch,          -- після 0009; до неї рядок нижче
       (p.user_id is not null)                                      as has_progress,
       coalesce(jsonb_array_length(p.state -> 'completed'), 0)      as lessons,
       coalesce(p.answers_total, 0)                                 as answers,
       (select count(*) from public.progress_ops j where j.user_id = a.id) as ops
  from public.allowed_users a
  left join public.progress p on p.user_id = a.id
 order by a.is_admin desc, a.created_at;

-- Якщо 0009 ще не застосовано (колонки progress_epoch і таблиці progress_ops немає) — той самий список без них:
-- select a.id, a.username, a.display_name, a.status, a.is_admin, a.last_login_at, (p.user_id is not null) as has_progress,
--        coalesce(jsonb_array_length(p.state -> 'completed'), 0) as lessons, coalesce(p.answers_total, 0) as answers
--   from public.allowed_users a left join public.progress p on p.user_id = a.id order by a.is_admin desc, a.created_at;

-- ───────── Команда скидання — НЕ запускати без окремого рішення власника ─────────
-- Підставити ідентифікатор запуску (латиниця, цифри, _ . : -) і затверджені id учёток:
--   select public.reset_progress('window-2026-11-XX', array['<id 1>', '<id 2>']::uuid[]);
-- Повторний запуск з тим самим ідентифікатором нічого не змінює й повертає попередній результат.
-- Відновлення однієї учётки з архіву:
--   select public.restore_progress('window-2026-11-XX', '<id>'::uuid);
