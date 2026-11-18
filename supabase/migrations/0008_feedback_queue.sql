-- ============================================================================
-- GRINDSET: черга відгуків для Claude (ТЗ 004, етап E2). Додається ПІСЛЯ 0001–0007. Аддитивна: старі рядки й старі збірки працюють.
-- Як застосувати: локально — автотести supabase/sqltest; на продакшні — ЛИШЕ в погодженому вікні викладки (SQL Editor → весь файл → Run).
-- Можна запускати повторно.
-- Що робить:
--  1) feedback: нові види «коментар» / «пропозиція» (старі 'bug' і 'idea' лишаються), контекст гілки й кроку тренажера;
--  2) тестер читає ЛИШЕ свої відгуки (без поміток власника);
--  3) feedback_review — помітка власника, статус «в черзі для Claude», «корисний»: таблиця без політик, доступ лише через функції адміна;
--  4) admin_feedback_queue(), admin_feedback_review(), admin_contributors() — лише для адміна.
-- ============================================================================

-- ───────── 1. Види й контекст ─────────
alter table public.feedback drop constraint if exists feedback_kind_check;
alter table public.feedback add constraint feedback_kind_check check (kind in ('bug', 'idea', 'comment', 'proposal'));
alter table public.feedback add column if not exists branch text check (branch is null or char_length(branch) <= 8);
alter table public.feedback add column if not exists sim_step int check (sim_step is null or sim_step between 0 and 999);
alter table public.feedback drop constraint if exists feedback_screen_len;
alter table public.feedback add constraint feedback_screen_len check (screen is null or char_length(screen) <= 80);

-- Відгуки, надіслані збіркою b26+ ДО цієї міграції (старий формат, ТЗ 006, 4.1): гілка й крок тренажера були лише в тексті
-- «… (гілка TOV, тренажер, крок 14)». Переносимо їх у нові колонки; вид, текст і решту колонок не чіпаємо. Повторний запуск нічого не змінює.
update public.feedback set branch = coalesce(substring(body from '\(гілка ([A-Z]{3})[,)]'), substring(lesson_id from '^BR-([A-Z]{3})-'))
  where branch is null and (body ~ '\(гілка [A-Z]{3}[,)]' or lesson_id ~ '^BR-[A-Z]{3}-');
update public.feedback set sim_step = (substring(body from 'тренажер, крок ([0-9]{1,3})\)'))::int - 1
  where sim_step is null and body ~ 'тренажер, крок [0-9]{1,3}\)' and (substring(body from 'тренажер, крок ([0-9]{1,3})\)'))::int between 1 and 1000;

-- ───────── 2. Тестер бачить лише свої відгуки ─────────
drop policy if exists feedback_own_read on public.feedback;
create policy feedback_own_read on public.feedback for select to authenticated
  using (public.is_active_user() and user_id = public.my_allowed_id());

-- ───────── 3. Помітки власника (окремо: тестер їх не бачить навіть у своїх відгуках) ─────────
create table if not exists public.feedback_review (
  feedback_id bigint primary key references public.feedback (id) on delete cascade,
  note        text check (note is null or char_length(note) <= 2000),
  status      text not null default 'new' check (status in ('new', 'queued', 'done', 'skip')),
  useful      boolean not null default false,
  updated_at  timestamptz not null default now()
);
alter table public.feedback_review enable row level security; -- політик немає: лише функції нижче
revoke all on public.feedback_review from public, anon, authenticated;

-- ───────── 4. Функції адміна ─────────
create or replace function public.admin_feedback_queue() returns table (
  id bigint, username text, kind text, screen text, lesson_id text, step_idx int, branch text, sim_step int,
  body text, build int, created_ms bigint, note text, status text, useful boolean
)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  return query
    select f.id, f.username, f.kind, f.screen, f.lesson_id, f.step_idx, f.branch, f.sim_step,
           f.body, f.build, (extract(epoch from f.created_at) * 1000)::bigint,
           r.note, coalesce(r.status, 'new'), coalesce(r.useful, false)
    from public.feedback f
    left join public.feedback_review r on r.feedback_id = f.id
    order by f.created_at desc
    limit 1000;
end
$$;

create or replace function public.admin_feedback_review(p_id bigint, p_note text, p_status text, p_useful boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  if p_status not in ('new', 'queued', 'done', 'skip') then raise exception 'bad_status'; end if;
  if not exists (select 1 from public.feedback where id = p_id) then raise exception 'not_found'; end if;
  insert into public.feedback_review (feedback_id, note, status, useful, updated_at)
  values (p_id, nullif(btrim(p_note), ''), p_status, coalesce(p_useful, false), now())
  on conflict (feedback_id) do update
    set note = excluded.note, status = excluded.status, useful = excluded.useful, updated_at = now();
end
$$;

-- Зведення внеску тестерів: число відгуків і позначених корисними (бачить лише власник)
create or replace function public.admin_contributors() returns table (username text, total bigint, useful bigint, last_ms bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin_user() then raise exception 'forbidden'; end if;
  return query
    select f.username, count(*)::bigint, count(*) filter (where r.useful)::bigint, (extract(epoch from max(f.created_at)) * 1000)::bigint
    from public.feedback f
    left join public.feedback_review r on r.feedback_id = f.id
    group by f.username
    order by count(*) desc;
end
$$;

revoke execute on function public.admin_feedback_queue(), public.admin_feedback_review(bigint, text, text, boolean), public.admin_contributors() from public, anon;
grant execute on function public.admin_feedback_queue(), public.admin_feedback_review(bigint, text, text, boolean), public.admin_contributors() to authenticated;
