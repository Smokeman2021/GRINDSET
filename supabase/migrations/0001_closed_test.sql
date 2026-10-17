-- ============================================================================
-- GRINDSET: закритий тест. Таблиці, правила доступу (RLS) і функції.
-- Як застосувати: Supabase → SQL Editor → New query → вставити ВЕСЬ цей файл → Run.
-- Файл можна запускати повторно: наявне не ламається.
-- Схема доступу: білий список allowed_users; користувач бачить лише своє; один активний сеанс на акаунт
-- (id сеансу приходить у заголовку x-sid кожного запиту й порівнюється з allowed_users.active_sid).
-- Бачити таблиці й відгуки в повному обсязі може лише адмін (прапорець is_admin).
-- ============================================================================

-- ───────── Білий список ─────────
create table if not exists public.allowed_users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null unique,                         -- нижній регістр, без @ (лише для показу й першого входу)
  display_name  text,
  telegram_id   bigint unique,                                -- привʼязується при першому вході; далі зіставляємо за ним
  status        text not null default 'invited' check (status in ('invited', 'active', 'blocked')),
  is_admin      boolean not null default false,
  auth_user_id  uuid unique references auth.users (id) on delete set null,
  active_sid    text,                                         -- активний сеанс (один на акаунт)
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);

-- ───────── Службові функції ─────────

-- id сеансу з заголовка запиту
create or replace function public.current_sid() returns text
language sql stable as $$
  select nullif(coalesce(nullif(current_setting('request.headers', true), ''), '{}')::json ->> 'x-sid', '')
$$;

create or replace function public.is_active_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.allowed_users a
    where a.auth_user_id = auth.uid()
      and a.status <> 'blocked'
      and a.active_sid is not null
      and a.active_sid = public.current_sid()
  )
$$;

create or replace function public.is_admin_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.allowed_users a
    where a.auth_user_id = auth.uid()
      and a.is_admin
      and a.status <> 'blocked'
      and a.active_sid is not null
      and a.active_sid = public.current_sid()
  )
$$;

-- id запису в білому списку для поточного користувача (лише якщо сеанс активний)
create or replace function public.my_allowed_id() returns uuid
language sql stable security definer set search_path = public as $$
  select a.id from public.allowed_users a
  where a.auth_user_id = auth.uid()
    and a.status <> 'blocked'
    and a.active_sid is not null
    and a.active_sid = public.current_sid()
$$;

-- хто я і чи мій сеанс ще активний (повертає дані навіть коли сеанс замінено: щоб показати «вхід з іншого пристрою»)
create or replace function public.session_me() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object(
    'id', a.id,
    'telegram_id', a.telegram_id,
    'username', a.username,
    'display_name', a.display_name,
    'is_admin', a.is_admin,
    'session_ok', (a.status <> 'blocked' and a.active_sid is not null and a.active_sid = public.current_sid())
  )
  from public.allowed_users a
  where a.auth_user_id = auth.uid()
  limit 1
$$;

-- вихід: скидає активний сеанс, лише якщо він мій
create or replace function public.end_session() returns void
language sql security definer set search_path = public as $$
  update public.allowed_users set active_sid = null
  where auth_user_id = auth.uid() and active_sid = public.current_sid()
$$;

-- викликає лише функція входу (service_role): знищує всі сеанси користувача, щоб старий пристрій не міг оновити токен
create or replace function public.revoke_user_sessions(p_user uuid) returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.sessions where user_id = p_user
$$;

-- ───────── Прогрес (один JSON на гравця) ─────────
create table if not exists public.progress (
  user_id    uuid primary key references public.allowed_users (id) on delete cascade,
  state      jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.save_progress(p_state jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.my_allowed_id();
  t   timestamptz := now();
begin
  if uid is null then raise exception 'session_replaced'; end if;
  if pg_column_size(p_state) > 1000000 then raise exception 'state_too_large'; end if;
  insert into public.progress (user_id, state, updated_at) values (uid, p_state, t)
  on conflict (user_id) do update set state = excluded.state, updated_at = excluded.updated_at;
  return (extract(epoch from t) * 1000)::bigint;
end
$$;

create or replace function public.load_progress() returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid uuid := public.my_allowed_id();
  r   public.progress;
begin
  if uid is null then raise exception 'session_replaced'; end if;
  select * into r from public.progress where user_id = uid;
  if not found then return null; end if;
  return json_build_object('state', r.state, 'updated_ms', (extract(epoch from r.updated_at) * 1000)::bigint);
end
$$;

-- ───────── Відгуки й події (читає лише адмін) ─────────
create table if not exists public.feedback (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.allowed_users (id) on delete set null,
  username   text,
  kind       text not null default 'bug' check (kind in ('bug', 'idea')),
  screen     text,
  lesson_id  text,
  step_idx   int,
  body       text not null check (char_length(body) between 1 and 2000),
  build      int,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.allowed_users (id) on delete set null,
  username   text,
  name       text not null,
  props      jsonb,
  build      int,
  created_at timestamptz not null default now()
);
create index if not exists events_name_idx on public.events (name, created_at);

-- ───────── Keep-alive (читає будь-хто: це лише «пульс» для безкоштовного плану) ─────────
create table if not exists public.keepalive (id int primary key);
insert into public.keepalive (id) values (1) on conflict do nothing;

-- ───────── Правила доступу (RLS) ─────────
alter table public.allowed_users enable row level security;
alter table public.progress      enable row level security;   -- без політик: лише через функції вище
alter table public.feedback      enable row level security;
alter table public.events        enable row level security;
alter table public.keepalive     enable row level security;

drop policy if exists allowed_admin_all on public.allowed_users;
create policy allowed_admin_all on public.allowed_users for all to authenticated
  using (public.is_admin_user()) with check (public.is_admin_user());

drop policy if exists feedback_insert on public.feedback;
create policy feedback_insert on public.feedback for insert to authenticated
  with check (public.is_active_user() and user_id = public.my_allowed_id());
drop policy if exists feedback_admin_read on public.feedback;
create policy feedback_admin_read on public.feedback for select to authenticated using (public.is_admin_user());

drop policy if exists events_insert on public.events;
create policy events_insert on public.events for insert to authenticated
  with check (public.is_active_user() and user_id = public.my_allowed_id());
drop policy if exists events_admin_read on public.events;
create policy events_admin_read on public.events for select to authenticated using (public.is_admin_user());

drop policy if exists keepalive_read on public.keepalive;
create policy keepalive_read on public.keepalive for select to anon, authenticated using (true);

-- ───────── Права ─────────
revoke all on public.allowed_users, public.progress, public.feedback, public.events from anon;
grant select, insert, update, delete on public.allowed_users to authenticated;   -- звужено політикою (лише адмін)
grant insert, select on public.feedback to authenticated;
grant insert, select on public.events   to authenticated;
grant select on public.keepalive to anon, authenticated;

revoke execute on function public.session_me(), public.end_session(), public.save_progress(jsonb), public.load_progress(),
  public.revoke_user_sessions(uuid), public.is_active_user(), public.is_admin_user(), public.my_allowed_id() from public, anon;
grant execute on function public.session_me(), public.end_session(), public.save_progress(jsonb), public.load_progress(),
  public.is_active_user(), public.is_admin_user(), public.my_allowed_id() to authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
grant execute on function public.current_sid() to anon, authenticated;

-- ───────── Перший адмін (ЗАМІНИ username на свій @username без @ і запусти окремо) ─────────
-- insert into public.allowed_users (username, display_name, status, is_admin)
-- values ('твій_username', 'Автор', 'active', true)
-- on conflict (username) do update set is_admin = true, status = 'active';
