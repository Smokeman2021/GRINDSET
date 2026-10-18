-- ============================================================================
-- GRINDSET: вхід за персональним кодом (варіант Б). Додається ПІСЛЯ 0001_closed_test.sql.
-- Як застосувати: Supabase → SQL Editor → New query → вставити ВЕСЬ файл → Run. Можна запускати повторно.
-- Як видати код тестеру: select public.issue_invite('нік_тестера');   (нік без @, малими літерами)
--   Результат: код виду K7M2-9QXP-4TDH. Він показується ОДИН раз, у базі лишається лише хеш. Повторний виклик видасть новий код
--   і скасує старий (так «блокують» код, який злили).
-- ============================================================================

create extension if not exists pgcrypto with schema extensions;

-- ───────── Поля для коду й лічильника спроб ─────────
alter table public.allowed_users
  add column if not exists invite_salt      text,
  add column if not exists invite_hash      text,
  add column if not exists invite_issued_at timestamptz,
  add column if not exists failed_attempts  int not null default 0,
  add column if not exists locked_until     timestamptz;

-- ───────── Обмеження частоти спроб (за адресою); читає й пише лише функція входу (service_role) ─────────
create table if not exists public.login_throttle (
  key          text primary key,
  window_start timestamptz not null default now(),
  count        int not null default 0
);
alter table public.login_throttle enable row level security;   -- без політик: недоступна для anon і authenticated
revoke all on public.login_throttle from anon, authenticated;

-- true = можна продовжувати, false = ліміт вичерпано
create or replace function public.throttle_hit(p_key text, p_limit int, p_window_seconds int) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  c int;
begin
  insert into public.login_throttle as t (key, window_start, count) values (p_key, now(), 1)
  on conflict (key) do update set
    count = case when t.window_start < now() - make_interval(secs => p_window_seconds) then 1 else t.count + 1 end,
    window_start = case when t.window_start < now() - make_interval(secs => p_window_seconds) then now() else t.window_start end
  returning count into c;
  -- прибираємо старі записи (раз на ~100 викликів), щоб таблиця не росла
  if random() < 0.01 then delete from public.login_throttle where window_start < now() - interval '1 day'; end if;
  return c <= p_limit;
end
$$;
revoke execute on function public.throttle_hit(text, int, int) from public, anon, authenticated;
grant execute on function public.throttle_hit(text, int, int) to service_role;

-- ───────── Видача коду ─────────
-- Викликати може адмін застосунку (екран /admin) або ти з SQL Editor. Код: 12 символів з алфавіту без схожих літер.
-- Хеш рахується так само, як у функції входу: sha256(сіль || ':' || код без дефісів у верхньому регістрі).
create or replace function public.issue_invite(p_username text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 символ
  code  text := '';
  b     int;
  salt  text := encode(gen_random_bytes(16), 'hex');
  uname text := lower(regexp_replace(trim(p_username), '^@', ''));
begin
  if not (session_user in ('postgres', 'supabase_admin') or auth.role() = 'service_role' or public.is_admin_user()) then
    raise exception 'forbidden';
  end if;
  -- рівномірний вибір символа: відкидаємо байти, що дали б зсув (256 = 31*8 + 8)
  while length(code) < 12 loop
    b := get_byte(gen_random_bytes(1), 0);
    if b < 248 then code := code || substr(alphabet, (b % 31) + 1, 1); end if;
  end loop;
  update public.allowed_users
     set invite_salt = salt,
         invite_hash = encode(digest(salt || ':' || code, 'sha256'), 'hex'),
         invite_issued_at = now(),
         failed_attempts = 0,
         locked_until = null
   where username = uname;
  if not found then raise exception 'user_not_found: додай нік у allowed_users'; end if;
  return substr(code, 1, 4) || '-' || substr(code, 5, 4) || '-' || substr(code, 9, 4);
end
$$;
revoke execute on function public.issue_invite(text) from public, anon;
grant execute on function public.issue_invite(text) to authenticated, service_role;
