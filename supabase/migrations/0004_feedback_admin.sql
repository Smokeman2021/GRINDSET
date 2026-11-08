-- ============================================================================
-- GRINDSET: відгуки тестерів і керування тестерами з екрана /admin. Додається ПІСЛЯ 0001–0003.
-- Як застосувати: Supabase → SQL Editor → New query → вставити ВЕСЬ файл → Run. Можна запускати повторно.
-- Що робить:
--  1) тригер на feedback: user_id і username беруться з сеансу на сервері, клієнт їх підробити не може;
--  2) admin_testers() / admin_add_tester() / admin_set_status(): керування білим списком лише для адміна,
--     хеші кодів у застосунок не віддаються. Видача коду: наявна issue_invite() з 0002.
-- ============================================================================

-- ───────── Відгук: автор і нік підставляє сервер ─────────
create or replace function public.feedback_fill() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a public.allowed_users;
begin
  select * into a from public.allowed_users where id = public.my_allowed_id();
  if not found then raise exception 'session_replaced'; end if;
  new.user_id := a.id;
  new.username := a.username;
  new.body := btrim(new.body);
  return new;
end
$$;

drop trigger if exists feedback_fill_trg on public.feedback;
create trigger feedback_fill_trg before insert on public.feedback
  for each row execute function public.feedback_fill();

-- ───────── Керування тестерами (лише адмін) ─────────
create or replace function public.admin_testers() returns table (
  id uuid, username text, display_name text, status text, is_admin boolean,
  last_login_ms bigint, invite_issued_ms bigint
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  return query
    select a.id, a.username, a.display_name, a.status, a.is_admin,
           (extract(epoch from a.last_login_at) * 1000)::bigint,
           (extract(epoch from a.invite_issued_at) * 1000)::bigint
    from public.allowed_users a
    order by a.is_admin desc, a.created_at;
end
$$;

create or replace function public.admin_add_tester(p_username text, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  uname text := lower(regexp_replace(btrim(p_username), '^@', ''));
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  if uname !~ '^[a-z0-9_]{3,32}$' then raise exception 'bad_username'; end if;
  insert into public.allowed_users (username, display_name, status)
  values (uname, nullif(btrim(p_name), ''), 'invited')
  on conflict (username) do nothing;
  if not found then raise exception 'already_exists'; end if;
end
$$;

-- 'blocked' ще й скидає активний сеанс: тестера вибиває з уже відкритого застосунку
create or replace function public.admin_set_status(p_id uuid, p_status text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  if p_status not in ('active', 'blocked') then raise exception 'bad_status'; end if;
  if p_id = public.my_allowed_id() then raise exception 'cannot_change_self'; end if;
  update public.allowed_users
     set status = p_status,
         active_sid = case when p_status = 'blocked' then null else active_sid end
   where id = p_id;
  if not found then raise exception 'user_not_found'; end if;
end
$$;

revoke execute on function public.feedback_fill(), public.admin_testers(), public.admin_add_tester(text, text), public.admin_set_status(uuid, text) from public, anon;
grant execute on function public.admin_testers(), public.admin_add_tester(text, text), public.admin_set_status(uuid, text) to authenticated;
