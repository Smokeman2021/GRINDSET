-- У лізі пріоритет має ім’я з профілю GRINDSET. Новачки без збереженого профілю теж лишаються в списку.
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
        select a.id, coalesce(
          case when jsonb_typeof(p.state -> 'playerName') = 'string' then
            nullif(left(btrim(regexp_replace(p.state ->> 'playerName', '[[:space:][:cntrl:]]+', ' ', 'g')), 14), '')
          end,
          nullif(btrim(a.display_name), ''),
          a.username
        ) as name
          from public.allowed_users a
          left join public.progress p on p.user_id = a.id
         where a.status = 'active' and not a.is_service
      ) participant
  );
end;
$$;

revoke all on function public.weekly_league_roster() from public, anon, authenticated, service_role;
grant execute on function public.weekly_league_roster() to authenticated;
