-- ============================================================================
-- 0010 · Службові учітки (ТЗ 008): preview_check та подібні не беруть участі в рейтингу реальних тестерів.
-- Аддитивно: нове поле allowed_users.is_service (типово false) і та сама leaderboard_accuracy() з однією новою умовою.
-- Підпис функції не змінюється, тож чинна збірка (b24) і нова (b29) викликають її однаково. Порядок у вікні: одразу після 0007.
-- Як позначити учітку службовою:  update public.allowed_users set is_service = true where username = 'preview_check';
-- ============================================================================

alter table public.allowed_users add column if not exists is_service boolean not null default false;

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
       and not a.is_service
       and p.answers_total >= 10
     order by 2 desc, 3 desc, 1 asc   -- номери колонок: імена збігаються зі змінними plpgsql
     limit 100;
end
$$;

revoke execute on function public.leaderboard_accuracy() from public, anon;
grant execute on function public.leaderboard_accuracy() to authenticated;
