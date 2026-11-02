-- ============================================================================
-- GRINDSET: рейтинг точності відповідей (змагання реальних гравців). Додається ПІСЛЯ 0001 і 0002.
-- Як застосувати: Supabase → SQL Editor → New query → вставити ВЕСЬ файл → Run. Можна запускати повторно.
-- Що робить:
--   1) у таблиці progress зʼявляються лічильники відповідей (заповнюються з JSON прогресу при кожному збереженні);
--   2) функція leaderboard_accuracy() віддає ТІЛЬКИ публічне: імʼя, точність у %, кількість відповідей, позначку «це я».
-- Правила рейтингу: лише status = 'active' (не blocked, не invited), БЕЗ адмінів, мінімум 30 відповідей,
-- при рівній точності вище той, у кого більше відповідей. RLS не змінюється: таблиці так само закриті, доступ лише через функції.
-- ============================================================================

alter table public.progress
  add column if not exists answers_total   int not null default 0,
  add column if not exists answers_correct int not null default 0;

-- Те саме збереження прогресу, що в 0001, плюс витяг лічильників із JSON (з перевіркою: лише цілі числа, correct ≤ total)
create or replace function public.save_progress(p_state jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.my_allowed_id();
  t   timestamptz := now();
  tot int := 0;
  cor int := 0;
begin
  if uid is null then raise exception 'session_replaced'; end if;
  if pg_column_size(p_state) > 1000000 then raise exception 'state_too_large'; end if;
  if (p_state ->> 'answersTotal') ~ '^[0-9]{1,8}$' then tot := (p_state ->> 'answersTotal')::int; end if;
  if (p_state ->> 'answersCorrect') ~ '^[0-9]{1,8}$' then cor := (p_state ->> 'answersCorrect')::int; end if;
  cor := least(cor, tot);
  insert into public.progress (user_id, state, updated_at, answers_total, answers_correct) values (uid, p_state, t, tot, cor)
  on conflict (user_id) do update set
    state = excluded.state,
    updated_at = excluded.updated_at,
    answers_total = excluded.answers_total,
    answers_correct = excluded.answers_correct;
  return (extract(epoch from t) * 1000)::bigint;
end
$$;

-- Лічильники для вже збережених прогресів (одноразово, безпечно повторювати)
update public.progress
   set answers_total = (state ->> 'answersTotal')::int,
       answers_correct = least((state ->> 'answersCorrect')::int, (state ->> 'answersTotal')::int)
 where (state ->> 'answersTotal') ~ '^[0-9]{1,8}$' and (state ->> 'answersCorrect') ~ '^[0-9]{1,8}$' and answers_total = 0;

-- Рейтинг: публічні поля й нічого більше (без id, ніка-логіна, прогресу, кодів, статусу)
create or replace function public.leaderboard_accuracy()
returns table (name text, accuracy numeric, answers int, is_me boolean)
language plpgsql stable security definer set search_path = public as $$
declare
  me uuid := public.my_allowed_id();
begin
  if me is null then raise exception 'session_replaced'; end if;   -- лише для тестерів з активним сеансом
  return query
    select coalesce(nullif(a.display_name, ''), a.username)::text as name,
           round(p.answers_correct::numeric * 100 / p.answers_total, 1) as accuracy,
           p.answers_total as answers,
           (a.id = me) as is_me
      from public.progress p
      join public.allowed_users a on a.id = p.user_id
     where a.status = 'active'
       and not a.is_admin
       and p.answers_total >= 30
     order by 2 desc, 3 desc, 1 asc   -- номери колонок: імена збігаються зі змінними plpgsql
     limit 100;
end
$$;

revoke execute on function public.leaderboard_accuracy() from public, anon;
grant execute on function public.leaderboard_accuracy() to authenticated;
