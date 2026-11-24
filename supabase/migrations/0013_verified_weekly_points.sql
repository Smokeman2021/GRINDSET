-- Інфраструктура заліку. Журнал прогресу сам по собі не є перевіркою відповідей.
-- Нарахування викликає лише довірений сервер після незалежної перевірки проходження.
create table if not exists public.league_eligible_lessons (
  lesson_id text primary key
);

-- Чинні уроки посібника b35. Архівні курси, самоперевірка й фінали гілок не входять до заліку.
insert into public.league_eligible_lessons (lesson_id) values
  ('BR-ADT-A2-HB-3.10.1'),
  ('BR-ADT-A2-HB-3.10.2'),
  ('BR-CRY-A2-HB-3.8.1'),
  ('BR-CRY-A2-HB-3.8.2'),
  ('BR-CRY-A2-HB-3.8.3'),
  ('BR-CRY-A2-HB-3.8.4'),
  ('BR-CRY-A2-HB-3.8.5'),
  ('BR-CRY-A2-HB-3.8.6'),
  ('BR-DAT-A2-HB-3.4.1'),
  ('BR-DAT-A2-HB-3.4.2'),
  ('BR-DAT-A2-HB-3.4.3'),
  ('BR-DAT-A2-HB-3.4.4'),
  ('BR-DAT-A2-HB-3.4.5'),
  ('BR-DAT-A2-HB-3.4.6'),
  ('BR-GAM-A2-HB-3.7.1'),
  ('BR-GAM-A2-HB-3.7.2'),
  ('BR-GAM-A2-HB-3.7.3'),
  ('BR-GAM-A2-HB-3.7.4'),
  ('BR-GAM-A2-HB-3.7.5'),
  ('BR-GAM-A2-HB-3.7.6'),
  ('BR-GAM-A2-HB-3.7.7'),
  ('BR-GAM-A2-HB-3.7.8'),
  ('BR-INF-A2-HB-3.5.1'),
  ('BR-INF-A2-HB-3.5.2'),
  ('BR-INF-A2-HB-3.5.3'),
  ('BR-INF-A2-HB-3.5.4'),
  ('BR-INF-A2-HB-3.5.5'),
  ('BR-INF-A2-HB-3.5.6'),
  ('BR-MOB-A2-HB-3.6.1'),
  ('BR-MOB-A2-HB-3.6.2'),
  ('BR-MOB-A2-HB-3.6.3'),
  ('BR-MOB-A2-HB-3.6.4'),
  ('BR-MOB-A2-HB-3.6.5'),
  ('BR-MOB-A2-HB-3.6.6'),
  ('BR-MOB-A2-HB-3.6.7'),
  ('BR-NUT-A2-HB-3.2.1'),
  ('BR-NUT-A2-HB-3.2.2'),
  ('BR-NUT-A2-HB-3.2.3'),
  ('BR-NUT-A2-HB-3.2.4'),
  ('BR-NUT-A2-HB-3.2.5'),
  ('BR-NUT-A2-HB-3.2.6'),
  ('BR-NUT-A2-HB-3.2.7'),
  ('BR-STA-A2-HB-0.1'),
  ('BR-STA-A2-HB-0.2'),
  ('BR-STA-A2-HB-0.3'),
  ('BR-STA-A2-HB-0.4'),
  ('BR-STA-A2-HB-0.5'),
  ('BR-STA-A2-HB-0.6'),
  ('BR-STA-A2-HB-1.1'),
  ('BR-STA-A2-HB-1.10'),
  ('BR-STA-A2-HB-1.11'),
  ('BR-STA-A2-HB-1.12'),
  ('BR-STA-A2-HB-1.13'),
  ('BR-STA-A2-HB-1.14'),
  ('BR-STA-A2-HB-1.2'),
  ('BR-STA-A2-HB-1.3'),
  ('BR-STA-A2-HB-1.4'),
  ('BR-STA-A2-HB-1.5'),
  ('BR-STA-A2-HB-1.6a'),
  ('BR-STA-A2-HB-1.6b'),
  ('BR-STA-A2-HB-1.6c'),
  ('BR-STA-A2-HB-1.6d'),
  ('BR-STA-A2-HB-1.7a'),
  ('BR-STA-A2-HB-1.7b'),
  ('BR-STA-A2-HB-1.7c'),
  ('BR-STA-A2-HB-1.8a'),
  ('BR-STA-A2-HB-1.8b'),
  ('BR-STA-A2-HB-1.8c'),
  ('BR-STA-A2-HB-1.8d'),
  ('BR-STA-A2-HB-1.9a'),
  ('BR-STA-A2-HB-1.9b'),
  ('BR-STA-A2-HB-2-final'),
  ('BR-STA-A2-HB-2.1'),
  ('BR-STA-A2-HB-2.2'),
  ('BR-STA-A2-HB-2.3'),
  ('BR-STA-A2-HB-2.4'),
  ('BR-STA-A2-HB-2.5'),
  ('BR-STA-A2-HB-2.6'),
  ('BR-STA-A2-HB-2.7'),
  ('BR-STA-A2-HB-2.8'),
  ('BR-STA-A2-HB-2.9'),
  ('BR-STA-A2-HB-4.1'),
  ('BR-STA-A2-HB-4.2'),
  ('BR-STA-A2-HB-4.3'),
  ('BR-STA-A2-HB-4.4'),
  ('BR-STA-A2-HB-4.5'),
  ('BR-STA-A2-HB-final0'),
  ('BR-STA-A2-HB-final1'),
  ('BR-SWP-A2-HB-3.9.1'),
  ('BR-SWP-A2-HB-3.9.2'),
  ('BR-TOV-A2-HB-3.1.1'),
  ('BR-TOV-A2-HB-3.1.2'),
  ('BR-TOV-A2-HB-3.1.3'),
  ('BR-TOV-A2-HB-3.1.4'),
  ('BR-TOV-A2-HB-3.1.5'),
  ('BR-TOV-A2-HB-3.1.6'),
  ('BR-TOV-A2-HB-3.1.7'),
  ('BR-TOV-A2-HB-3.1.F'),
  ('BR-TOV-A2-HB-3.3.1'),
  ('BR-TOV-A2-HB-3.3.2'),
  ('BR-TOV-A2-HB-3.3.3'),
  ('BR-TOV-A2-HB-3.3.4'),
  ('BR-TOV-A2-HB-3.3.5'),
  ('BR-TOV-A2-HB-3.3.6'),
  ('BR-TOV-A2-HB-3.3.7'),
  ('BR-TTK-A2-HB-3.11.1'),
  ('BR-TTK-A2-HB-3.11.2'),
  ('BR-TTK-A2-HB-3.11.3'),
  ('BR-TTK-A2-HB-3.11.4'),
  ('BR-TTK-A2-HB-3.11.5'),
  ('BR-TTK-A2-HB-3.11.6')
on conflict (lesson_id) do nothing;

create table if not exists public.league_lesson_credits (
  user_id uuid not null references public.allowed_users (id) on delete cascade,
  progress_epoch int not null check (progress_epoch >= 0),
  lesson_id text not null references public.league_eligible_lessons (lesson_id),
  source_op_id text not null,
  accepted_at timestamptz not null,
  primary key (user_id, progress_epoch, lesson_id)
);

create index if not exists league_credits_week_idx on public.league_lesson_credits (accepted_at, user_id, progress_epoch);
alter table public.league_eligible_lessons enable row level security;
alter table public.league_lesson_credits enable row level security;
revoke all on public.league_eligible_lessons, public.league_lesson_credits from public, anon, authenticated, service_role;

-- Підтверджуємо учасника та точний запис, який уже прийняв сервер. Блокування учітки узгоджене зі скиданням прогресу.
create or replace function public.record_verified_league_lesson(p_user_id uuid, p_epoch int, p_op_id text)
returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  awarded boolean;
begin
  perform 1
    from public.allowed_users a
   where a.id = p_user_id and a.status = 'active' and not a.is_service and a.progress_epoch = p_epoch
   for share;
  if not found then return false; end if;

  insert into public.league_lesson_credits (user_id, progress_epoch, lesson_id, source_op_id, accepted_at)
  select j.user_id, p_epoch, eligible.lesson_id, j.op_id, j.created_at
    from public.progress_ops j
    join public.league_eligible_lessons eligible on eligible.lesson_id = j.payload ->> 'lessonId'
   where j.user_id = p_user_id and j.op_id = p_op_id
     and j.kind = 'lesson' and j.status = 'applied'
     and (j.payload -> 'epoch') = to_jsonb(p_epoch)
     and (j.payload -> 'repeatable') is distinct from 'true'::jsonb
     and j.op_id not like 'legacy:%'
  on conflict (user_id, progress_epoch, lesson_id) do nothing
  returning true into awarded;

  return coalesce(awarded, false);
end;
$$;

revoke all on function public.record_verified_league_lesson(uuid, int, text) from public, anon, authenticated, service_role;
grant execute on function public.record_verified_league_lesson(uuid, int, text) to service_role;

create or replace function public.weekly_league_roster()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  viewer_id uuid := public.my_allowed_id();
  current_week date := date_trunc('week', now() at time zone 'Europe/Kyiv')::date;
begin
  if not exists (select 1 from public.allowed_users where id = viewer_id and status = 'active') then
    raise exception 'session_replaced';
  end if;

  return (
    with weekly_points as (
      select c.user_id, c.progress_epoch, count(*) as points
        from public.league_lesson_credits c
       where c.accepted_at >= (current_week::timestamp at time zone 'Europe/Kyiv')
         and c.accepted_at < ((current_week + 7)::timestamp at time zone 'Europe/Kyiv')
       group by c.user_id, c.progress_epoch
    )
    select jsonb_build_object(
      'week_start', current_week,
      'scoring_enabled', exists (
        select 1 from pg_catalog.pg_trigger t
         where t.tgrelid = 'public.progress_ops'::regclass
           and t.tgname = 'credit_pilot_league_lesson'
           and t.tgenabled in ('O', 'A')
      ),
      'players', coalesce(jsonb_agg(
        jsonb_build_object('name', participant.name, 'points', participant.points, 'is_me', participant.id = viewer_id)
        order by participant.points desc, lower(participant.name), participant.id
      ), '[]'::jsonb)
    )
      from (
        select a.id, coalesce(
          case when jsonb_typeof(p.state -> 'playerName') = 'string' then
            nullif(left(btrim(regexp_replace(p.state ->> 'playerName', '[[:space:][:cntrl:]]+', ' ', 'g')), 14), '')
          end,
          nullif(btrim(a.display_name), ''),
          a.username
        ) as name, coalesce(w.points, 0) as points
          from public.allowed_users a
          left join public.progress p on p.user_id = a.id
          left join weekly_points w on w.user_id = a.id and w.progress_epoch = a.progress_epoch
         where a.status = 'active' and not a.is_service
      ) participant
  );
end;
$$;

revoke all on function public.weekly_league_roster() from public, anon, authenticated, service_role;
grant execute on function public.weekly_league_roster() to authenticated;
