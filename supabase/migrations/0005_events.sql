-- ============================================================================
-- GRINDSET: мініаналітика (таблиця events з 0001 уже є). Додається ПІСЛЯ 0001–0004.
-- Як застосувати: Supabase → SQL Editor → New query → вставити ВЕСЬ файл → Run. Можна запускати повторно.
-- Що робить: (1) тригер підставляє автора й нік з сеансу на сервері, (2) дозволяє лише відомі назви подій
-- (session_start, lesson_start, lesson_complete, lesson_exit) і обмежує розмір props. Читає події лише адмін (RLS з 0001).
-- ============================================================================

create or replace function public.events_fill() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a public.allowed_users;
begin
  select * into a from public.allowed_users where id = public.my_allowed_id();
  if not found then raise exception 'session_replaced'; end if;
  new.user_id := a.id;
  new.username := a.username;
  return new;
end
$$;

drop trigger if exists events_fill_trg on public.events;
create trigger events_fill_trg before insert on public.events
  for each row execute function public.events_fill();

alter table public.events drop constraint if exists events_name_ok;
alter table public.events add constraint events_name_ok
  check (name in ('session_start', 'lesson_start', 'lesson_complete', 'lesson_exit'));

alter table public.events drop constraint if exists events_props_small;
alter table public.events add constraint events_props_small
  check (props is null or pg_column_size(props) < 2000);

revoke execute on function public.events_fill() from public, anon;
