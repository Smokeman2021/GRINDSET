-- ============================================================================
-- GRINDSET: поріг рейтингу точності 10 відповідей (було 30). Додається ПІСЛЯ 0001–0005.
-- Як застосувати: Supabase → SQL Editor → New query → вставити ВЕСЬ файл → Run. Можна запускати повторно.
-- Змінюється лише умова в leaderboard_accuracy(): answers_total >= 10. Решта правил і права без змін:
-- лише status = 'active', без адмінів, при рівній точності вище той, у кого більше відповідей; віддаються тільки публічні поля.
-- ============================================================================

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
       and p.answers_total >= 10
     order by 2 desc, 3 desc, 1 asc   -- номери колонок: імена збігаються зі змінними plpgsql
     limit 100;
end
$$;

revoke execute on function public.leaderboard_accuracy() from public, anon;
grant execute on function public.leaderboard_accuracy() to authenticated;
