-- Перший етап тижневої ліги: склад із реєстру, без нарахувань із клієнтського XP.
create or replace function public.weekly_league_roster()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  viewer_id uuid := public.my_allowed_id();
begin
  if not exists (select 1 from public.allowed_users where id = viewer_id and status = 'active') then
    raise exception 'session_replaced';
  end if;

  return (
    select jsonb_build_object(
      'week_start', date_trunc('week', now() at time zone 'Europe/Kyiv')::date,
      'players', coalesce(jsonb_agg(
        jsonb_build_object('name', participant.name, 'points', 0, 'is_me', participant.id = viewer_id)
        order by lower(participant.name), participant.id
      ), '[]'::jsonb)
    )
      from (
        select a.id, coalesce(nullif(btrim(a.display_name), ''), a.username) as name
          from public.allowed_users a
         where a.status = 'active' and not a.is_service
      ) participant
  );
end;
$$;

revoke all on function public.weekly_league_roster() from public, anon, authenticated, service_role;
grant execute on function public.weekly_league_roster() to authenticated;

-- Для старих збірок зберігаємо сигнатуру й власний рядок. Чужа точність більше не публікується.
create or replace function public.leaderboard_accuracy()
returns table (name text, accuracy numeric, answers int, is_me boolean)
language plpgsql stable security definer
set search_path = ''
as $$
declare
  viewer_id uuid := public.my_allowed_id();
begin
  if viewer_id is null then raise exception 'session_replaced'; end if;
  return query
    select coalesce(nullif(btrim(a.display_name), ''), a.username)::text,
           round(p.answers_correct::numeric * 100 / p.answers_total, 1),
           p.answers_total, true
      from public.progress p
      join public.allowed_users a on a.id = p.user_id
     where a.id = viewer_id and p.answers_total > 0;
end;
$$;

revoke all on function public.leaderboard_accuracy() from public, anon, authenticated, service_role;
grant execute on function public.leaderboard_accuracy() to authenticated;
