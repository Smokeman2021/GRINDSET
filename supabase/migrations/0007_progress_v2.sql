-- ============================================================================
-- GRINDSET: надійне збереження прогресу (ТЗ-01 v7, КРОК 1 «підготовка»). Додається ПІСЛЯ 0001–0006.
-- Як застосувати: Supabase → SQL Editor → New query → вставити ВЕСЬ файл → Run. Можна запускати повторно.
--
-- Що робить:
--   1) журнал операцій progress_ops, версія рядка rev, колонки ядра core / rewarded;
--   2) ознака режиму запису progress_settings.write_mode: 'legacy' (старий спосіб) або 'v2' (операції). Після цього файла = 'legacy';
--   3) нова функція save_progress_v2 (у режимі legacy нічого не пише й відповідає not_active) і load_progress_v2;
--   4) стара save_progress(p_state) лишається активною, але із ЗАХИСТОМ ВІД ЗАТИРАННЯ (пройдені уроки не зникають, лічильники не зменшуються);
--   5) функція перемикання set_progress_write_mode(mode): лише власник (SQL Editor або service_role).
--
-- ПЕРЕМИКАННЯ це НЕ частина міграції. Окремий крок за рішенням власника:
--     select public.set_progress_write_mode('v2');       -- увімкнути новий спосіб
--     select public.set_progress_write_mode('legacy');   -- відкат: лише зміна режиму, дані не чіпаються
-- У кожен момент активний рівно один спосіб запису: обидві функції запису читають режим під спільним блокуванням,
-- перемикання бере виключне. Запит або цілком до перемикання, або цілком після.
-- Журнал, rev і колонки ядра ніколи не видаляються.
-- ============================================================================

-- ───────── Режим запису ─────────
create table if not exists public.progress_settings (
  id         boolean primary key default true check (id),      -- рівно один рядок
  write_mode text not null default 'legacy' check (write_mode in ('legacy', 'v2')),
  changed_at timestamptz not null default now()
);
insert into public.progress_settings (id) values (true) on conflict do nothing;

create table if not exists public.progress_mode_log (
  id         bigint generated always as identity primary key,
  mode       text not null,
  previous   text not null,
  rows_count int not null default 0,
  changed_at timestamptz not null default now(),
  changed_by text
);

-- ───────── Версія, ядро, список нагороджених ─────────
alter table public.progress
  add column if not exists rev      bigint not null default 0,
  add column if not exists core     jsonb,
  add column if not exists rewarded text[] not null default '{}';

-- ───────── Журнал операцій: остаточний підсумок кожної операції за учёткою й opId (включно з відхиленими) ─────────
create table if not exists public.progress_ops (
  user_id    uuid not null references public.allowed_users (id) on delete cascade,
  op_id      text not null,
  kind       text not null,
  status     text not null,
  payload    jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, op_id)
);

alter table public.progress_settings enable row level security;   -- без політик: лише через функції
alter table public.progress_mode_log enable row level security;
alter table public.progress_ops      enable row level security;
revoke all on public.progress_settings, public.progress_mode_log, public.progress_ops from anon, authenticated;

-- ───────── Події: нові назви (наблюдаемость клієнта й старих збірок) ─────────
alter table public.events drop constraint if exists events_name_ok;
alter table public.events add constraint events_name_ok
  check (name in ('session_start', 'lesson_start', 'lesson_complete', 'lesson_exit', 'sync_error', 'sync_queue_stale', 'client_outdated'));

-- ───────── Допоміжні (чисті) функції ─────────

-- ціле число з JSON у межах [lo, hi]; не число → def
create or replace function public.progress_int(j jsonb, k text, def bigint, lo bigint, hi bigint) returns bigint
language sql immutable as $$
  select case when (j ->> k) ~ '^-?[0-9]{1,15}(\.[0-9]+)?$'
              then least(hi, greatest(lo, floor((j ->> k)::numeric)::bigint))
              else def end
$$;

-- невідʼємне ціле ≤ hi для полів операції; будь-що інше → null (операція відхиляється як rejected_invalid)
create or replace function public.progress_nat(j jsonb, k text, hi bigint) returns bigint
language sql immutable as $$
  select case when jsonb_typeof(j -> k) = 'number' and (j ->> k) ~ '^[0-9]{1,15}$' and (j ->> k)::bigint <= hi
              then (j ->> k)::bigint else null end
$$;

-- JSON-масив → text[] без повторів, порядок першої появи
create or replace function public.progress_texts(j jsonb) returns text[]
language sql immutable as $$
  select coalesce(array_agg(s.v order by s.o), '{}')
    from (select t.v, min(t.o) as o
            from jsonb_array_elements_text(case when jsonb_typeof(j) = 'array' then j else '[]'::jsonb end) with ordinality as t(v, o)
           where length(t.v) between 1 and 64
           group by t.v) s
$$;

-- обʼєднання двох списків без повторів: спершу a, далі нові з b
create or replace function public.progress_union(a text[], b text[]) returns text[]
language sql immutable as $$
  select coalesce(a, '{}') || coalesce(array(select x from unnest(coalesce(b, '{}')) with ordinality u(x, i)
                                              where x <> all (coalesce(a, '{}')) group by x order by min(i)), '{}')
$$;

-- Серверне ядро з повного знімка стану (ті самі назви полів, що в застосунку)
create or replace function public.progress_core_from_state(s jsonb) returns jsonb
language sql immutable as $$
  select jsonb_build_object(
    'completed',        to_jsonb(public.progress_texts(coalesce(s, '{}'::jsonb) -> 'completed')),
    'coins',            public.progress_int(coalesce(s, '{}'::jsonb), 'coins', 0, 0, 1000000000),
    'xp',               public.progress_int(coalesce(s, '{}'::jsonb), 'xp', 0, 0, 1000000000),
    'totalCoinsEarned', public.progress_int(coalesce(s, '{}'::jsonb), 'totalCoinsEarned', 0, 0, 1000000000),
    'answersTotal',     public.progress_int(coalesce(s, '{}'::jsonb), 'answersTotal', 0, 0, 99999999),
    'answersCorrect',   least(public.progress_int(coalesce(s, '{}'::jsonb), 'answersCorrect', 0, 0, 99999999),
                              public.progress_int(coalesce(s, '{}'::jsonb), 'answersTotal', 0, 0, 99999999)),
    'energy',           public.progress_int(coalesce(s, '{}'::jsonb), 'energy', 50, 0, 50),
    'energyAt',         public.progress_int(coalesce(s, '{}'::jsonb), 'energyAt', 0, 0, 9000000000000000),
    'hints',            public.progress_int(coalesce(s, '{}'::jsonb), 'hints', 0, 0, 100000),
    'comboShields',     public.progress_int(coalesce(s, '{}'::jsonb), 'comboShields', 0, 0, 100000),
    'doubleCoins',      public.progress_int(coalesce(s, '{}'::jsonb), 'doubleCoins', 0, 0, 1),
    'frames',           to_jsonb(public.progress_texts(coalesce(s, '{}'::jsonb) -> 'frames')),
    'streakFreezes',    public.progress_int(coalesce(s, '{}'::jsonb), 'streakFreezes', 0, 0, 2),
    'purchases',        public.progress_int(coalesce(s, '{}'::jsonb), 'purchases', 0, 0, 100000000)
  )
$$;

-- ───────── Старий спосіб: save_progress(p_state) із захистом від затирання ─────────
-- legacy: пише, але знімок не може забрати вже збережене:
--   • пройдені уроки = обʼєднання; XP, totalCoinsEarned, answersTotal, answersCorrect не зменшуються;
--   • монети = зароблено − витрачено, де «витрачено» (totalCoinsEarned − coins) теж не зменшується: покупка зберігається, нагорода не зникає;
--   • якщо знімок НЕ знає частини збережених уроків (інший пристрій, застаріла копія), його нові уроки додаються разом із нагородою
--     з його ж історії (history), а не замість збереженого. Повтор того самого знімка нічого не додає.
-- v2: нічого не пише; фіксує подію client_outdated з номером збірки (останній build з подій цієї учётки) і повертає
--     поточну позначку часу сервера БЕЗ помилки: виняток відкотив би й подію, а стара збірка після «успіху» не тягне серверний стан поверх локального.
create or replace function public.save_progress(p_state jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  uid       uuid := public.my_allowed_id();
  t         timestamptz := now();
  v_mode    text;
  r         public.progress;
  o         jsonb;
  n         jsonb;
  m         jsonb;
  o_done    text[];
  n_done    text[];
  v_added   text[];
  v_missing boolean;
  v_done    text[];
  v_xp      bigint;
  v_earned  bigint;
  v_spent   bigint;
  v_tot     bigint;
  v_cor     bigint;
  add_xp    bigint := 0;
  add_coins bigint := 0;
begin
  if uid is null then raise exception 'session_replaced'; end if;
  if pg_column_size(p_state) > 1000000 then raise exception 'state_too_large'; end if;

  perform pg_advisory_xact_lock_shared(701001);
  select s.write_mode into v_mode from public.progress_settings s where s.id;

  if v_mode = 'v2' then
    select * into r from public.progress p where p.user_id = uid;
    if not exists (select 1 from public.events e where e.user_id = uid and e.name = 'client_outdated' and e.created_at > t - interval '10 minutes') then
      insert into public.events (user_id, name, props, build)
      values (uid, 'client_outdated', jsonb_build_object('via', 'save_progress'),
              (select e.build from public.events e where e.user_id = uid and e.build is not null and e.name <> 'client_outdated' order by e.id desc limit 1));
    end if;
    return coalesce((extract(epoch from r.updated_at) * 1000)::bigint, 0);
  end if;

  n := public.progress_core_from_state(p_state);
  insert into public.progress (user_id, state, updated_at, rev, core, rewarded)
  values (uid, '{}'::jsonb, t, 0, null, '{}') on conflict (user_id) do nothing;
  select * into r from public.progress p where p.user_id = uid for update;

  if r.rev = 0 and r.state = '{}'::jsonb then
    m := n;                                               -- перший запис учётки
  else
    o := public.progress_core_from_state(r.state);
    o_done := public.progress_texts(o -> 'completed');
    n_done := public.progress_texts(n -> 'completed');
    v_added := array(select x from unnest(n_done) with ordinality u(x, i) where x <> all (o_done) order by i);
    v_missing := exists (select 1 from unnest(o_done) x where x <> all (n_done));
    if not v_missing then
      v_done := n_done;                                   -- знімок знає все збережене: звичайне продовження
      v_xp := greatest((o ->> 'xp')::bigint, (n ->> 'xp')::bigint);
      v_earned := greatest((o ->> 'totalCoinsEarned')::bigint, (n ->> 'totalCoinsEarned')::bigint);
    else
      v_done := o_done || v_added;                        -- знімок відстав: додаємо лише його нові уроки з нагородою з його історії
      select coalesce(sum(q.hx), 0), coalesce(sum(q.hc), 0) into add_xp, add_coins
        from (select distinct on (a.h ->> 'id')
                     public.progress_int(a.h, 'xp', 0, 0, 10000) as hx,
                     public.progress_int(a.h, 'coins', 0, 0, 100000) as hc
                from jsonb_array_elements(case when jsonb_typeof(p_state -> 'history') = 'array' then p_state -> 'history' else '[]'::jsonb end)
                     with ordinality as a(h, i)
               where a.h ->> 'id' = any (v_added)
               order by a.h ->> 'id', a.i desc) q;        -- history йде від нових до старих: беремо перше проходження
      v_xp := greatest((o ->> 'xp')::bigint + add_xp, (n ->> 'xp')::bigint);
      v_earned := greatest((o ->> 'totalCoinsEarned')::bigint + add_coins, (n ->> 'totalCoinsEarned')::bigint);
    end if;
    v_spent := greatest(0,
      (o ->> 'totalCoinsEarned')::bigint - (o ->> 'coins')::bigint,
      (n ->> 'totalCoinsEarned')::bigint - (n ->> 'coins')::bigint);
    v_tot := greatest((o ->> 'answersTotal')::bigint, (n ->> 'answersTotal')::bigint);
    v_cor := least(v_tot, greatest((o ->> 'answersCorrect')::bigint, (n ->> 'answersCorrect')::bigint));
    m := n || jsonb_build_object(
      'completed', to_jsonb(v_done),
      'xp', v_xp,
      'totalCoinsEarned', v_earned,
      'coins', greatest(0, v_earned - v_spent),
      'answersTotal', v_tot,
      'answersCorrect', v_cor,
      'frames', to_jsonb(public.progress_union(public.progress_texts(o -> 'frames'), public.progress_texts(n -> 'frames'))),
      'purchases', greatest((o ->> 'purchases')::bigint, (n ->> 'purchases')::bigint));
  end if;

  update public.progress p
     set state = p_state || m,
         core = m,
         updated_at = t,
         rev = p.rev + 1,
         answers_total = (m ->> 'answersTotal')::int,
         answers_correct = (m ->> 'answersCorrect')::int
   where p.user_id = uid;
  return (extract(epoch from t) * 1000)::bigint;
end
$$;

-- Старе завантаження (ним користуються лише старі збірки). Знімок завжди повний.
-- У режимі v2 позначка часу = 0: стара збірка, що має на пристрої свою позначку синхронізації, тоді НЕ тягне серверний стан
-- поверх локального (її правило: брати серверний, лише якщо він новіший), і невідправлений урок доживає до нової збірки,
-- яка перенесе його операцією legacy:<учётка>:<урок>. Чистий пристрій (без позначки) завантажує знімок як раніше.
create or replace function public.load_progress() returns json
language plpgsql stable security definer set search_path = public as $$
declare
  uid    uuid := public.my_allowed_id();
  r      public.progress;
  v_mode text;
begin
  if uid is null then raise exception 'session_replaced'; end if;
  select * into r from public.progress p where p.user_id = uid;
  if not found then return null; end if;
  select s.write_mode into v_mode from public.progress_settings s where s.id;
  return json_build_object(
    'state', r.state,
    'updated_ms', case when v_mode = 'v2' then 0 else (extract(epoch from r.updated_at) * 1000)::bigint end);
end
$$;

-- ───────── Новий спосіб: операції + клієнтський знімок з перевіркою версії ─────────
-- p_ops: масив операцій {opId, kind, ...}. Види: lesson, answers, energy, spend, quest, sim, use, skip, init.
-- Підсумок операції: applied | already_rewarded | rejected_no_coins | rejected_invalid | rejected_exists.
-- Повтор opId: ядро не змінюється, повертається ТОЙ САМИЙ підсумок, що був записаний уперше, з позначкою duplicate = true.
-- Операції застосовуються незалежно від p_base_rev; клієнтський знімок пишеться лише коли p_base_rev = поточній rev
-- (інакше client_state_conflict, знімок не пишеться). Суми XP і монет передає клієнт: сервер тут захищає від втрат і повторів,
-- але НЕ перевіряє розмір нагороди.
-- p_epoch (ТЗ 005 / 007): епоха прогресу. Тут не використовується (епохи ще немає); перевірку додає 0009. Параметр є вже тут, щоб
-- нова збірка могла писати між кроками «v2» і «0009» вікна, не чекаючи міграції.
drop function if exists public.save_progress_v2(bigint, jsonb, jsonb);
create or replace function public.save_progress_v2(p_base_rev bigint, p_ops jsonb, p_client_state jsonb, p_epoch int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid       uuid := public.my_allowed_id();
  t         timestamptz := now();
  v_mode    text;
  r         public.progress;
  c         jsonb;
  rw        text[];
  v_done    text[];
  op        jsonb;
  v_id      text;
  v_kind    text;
  v_prev    text;
  v_st      text;
  v_res     jsonb := '[]'::jsonb;
  v_changed boolean := false;
  v_cs      text := 'none';
  v_state   jsonb;
  v_rev     bigint;
  v_lesson  text;
  v_item    text;
  a         bigint;
  b         bigint;
  v_pristine boolean;
begin
  if uid is null then raise exception 'session_replaced'; end if;
  if p_ops is not null and jsonb_typeof(p_ops) <> 'array' then raise exception 'bad_ops'; end if;
  if pg_column_size(coalesce(p_ops, '[]'::jsonb)) + pg_column_size(coalesce(p_client_state, '{}'::jsonb)) > 1000000 then raise exception 'state_too_large'; end if;
  if jsonb_array_length(coalesce(p_ops, '[]'::jsonb)) > 500 then raise exception 'too_many_ops'; end if;

  perform pg_advisory_xact_lock_shared(701001);
  select s.write_mode into v_mode from public.progress_settings s where s.id;
  if v_mode <> 'v2' then
    return jsonb_build_object('status', 'not_active', 'mode', v_mode);     -- нічого не пишемо: клієнт тримає операції в черзі
  end if;

  insert into public.progress (user_id, state, updated_at, rev, core, rewarded)
  values (uid, '{}'::jsonb, t, 0, null, '{}') on conflict (user_id) do nothing;
  select * into r from public.progress p where p.user_id = uid for update;
  v_pristine := (r.rev = 0 and r.state = '{}'::jsonb);
  c := coalesce(r.core, public.progress_core_from_state(r.state));
  rw := r.rewarded;

  for op in select e.v from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb)) with ordinality as e(v, i) order by e.i loop
    v_id := case when jsonb_typeof(op) = 'object' then op ->> 'opId' else null end;
    v_kind := case when jsonb_typeof(op) = 'object' then op ->> 'kind' else null end;
    if v_id is null or length(v_id) not between 1 and 160 then
      v_res := v_res || jsonb_build_object('opId', v_id, 'status', 'rejected_invalid', 'duplicate', false);
      continue;
    end if;
    select j.status into v_prev from public.progress_ops j where j.user_id = uid and j.op_id = v_id;
    if found then
      v_res := v_res || jsonb_build_object('opId', v_id, 'status', v_prev, 'duplicate', true);
      continue;
    end if;

    v_st := 'applied';
    v_done := public.progress_texts(c -> 'completed');

    if v_kind = 'lesson' then
      v_lesson := op ->> 'lessonId';
      a := public.progress_nat(op, 'xp', 10000);
      b := public.progress_nat(op, 'coins', 100000);
      if v_lesson is null or v_lesson !~ '^[A-Za-z0-9_:.-]{1,64}$' or a is null or b is null then
        v_st := 'rejected_invalid';
      elsif op -> 'repeatable' = 'true'::jsonb then
        -- тренування / надолуження помилок: не урок курсу, у completed не йде, нараховується щоразу
        c := c || jsonb_build_object('xp', (c ->> 'xp')::bigint + a, 'coins', (c ->> 'coins')::bigint + b,
                                     'totalCoinsEarned', (c ->> 'totalCoinsEarned')::bigint + b);
      elsif v_lesson = any (rw) then
        v_st := 'already_rewarded';                      -- урок лишається пройденим, XP і монети не нараховуються
        if v_lesson <> all (v_done) then c := c || jsonb_build_object('completed', to_jsonb(v_done || v_lesson)); end if;
      else
        rw := rw || v_lesson;
        if v_lesson <> all (v_done) then v_done := v_done || v_lesson; end if;
        c := c || jsonb_build_object('completed', to_jsonb(v_done),
                                     'xp', (c ->> 'xp')::bigint + a, 'coins', (c ->> 'coins')::bigint + b,
                                     'totalCoinsEarned', (c ->> 'totalCoinsEarned')::bigint + b);
      end if;
      -- бустер X2 згоряє там, де нагороду нараховано (перше проходження або тренування);
      -- заморозку стріку витрачає будь-яке зараховане проходження, також повтор пройденого уроку
      if v_st = 'applied' and op -> 'doubled' = 'true'::jsonb then
        c := c || jsonb_build_object('doubleCoins', greatest(0, (c ->> 'doubleCoins')::bigint - 1));
      end if;
      if v_st <> 'rejected_invalid' and op -> 'freezeUsed' = 'true'::jsonb then
        c := c || jsonb_build_object('streakFreezes', greatest(0, (c ->> 'streakFreezes')::bigint - 1));
      end if;

    elsif v_kind = 'answers' then
      a := public.progress_nat(op, 'total', 1000);
      b := public.progress_nat(op, 'correct', 1000);
      if a is null or b is null or b > a then
        v_st := 'rejected_invalid';
      else
        c := c || jsonb_build_object('answersTotal', least(99999999, (c ->> 'answersTotal')::bigint + a),
                                     'answersCorrect', least(99999999, (c ->> 'answersCorrect')::bigint + b));
      end if;

    elsif v_kind = 'energy' then
      a := public.progress_nat(op, 'energy', 50);
      b := public.progress_nat(op, 'energyAt', 9000000000000000);
      if a is null or b is null then v_st := 'rejected_invalid';
      else c := c || jsonb_build_object('energy', a, 'energyAt', b); end if;

    elsif v_kind = 'spend' then
      a := public.progress_nat(op, 'cost', 10000000);
      v_item := op ->> 'item';
      if a is null or v_item is null or v_item !~ '^(energy10|energy20|energyFull|freeze|shield3|hint3|double|frame_[A-Za-z0-9_-]{1,40})$' then
        v_st := 'rejected_invalid';
      elsif (c ->> 'coins')::bigint < a then
        v_st := 'rejected_no_coins';
      else
        c := c || jsonb_build_object('coins', (c ->> 'coins')::bigint - a, 'purchases', (c ->> 'purchases')::bigint + 1);
        if v_item = 'energy10' then c := c || jsonb_build_object('energy', least(50, (c ->> 'energy')::bigint + 10));
        elsif v_item = 'energy20' then c := c || jsonb_build_object('energy', least(50, (c ->> 'energy')::bigint + 20));
        elsif v_item = 'energyFull' then c := c || jsonb_build_object('energy', 50);
        elsif v_item = 'freeze' then c := c || jsonb_build_object('streakFreezes', least(2, (c ->> 'streakFreezes')::bigint + 1));
        elsif v_item = 'shield3' then c := c || jsonb_build_object('comboShields', (c ->> 'comboShields')::bigint + 3);
        elsif v_item = 'hint3' then c := c || jsonb_build_object('hints', (c ->> 'hints')::bigint + 3);
        elsif v_item = 'double' then c := c || jsonb_build_object('doubleCoins', 1);
        else c := c || jsonb_build_object('frames', to_jsonb(public.progress_union(public.progress_texts(c -> 'frames'), array[substr(v_item, 7)])));
        end if;
      end if;

    elsif v_kind = 'quest' then
      b := public.progress_nat(op, 'coins', 100000);
      if b is null then v_st := 'rejected_invalid';
      else c := c || jsonb_build_object('coins', (c ->> 'coins')::bigint + b, 'totalCoinsEarned', (c ->> 'totalCoinsEarned')::bigint + b); end if;

    elsif v_kind = 'sim' then
      a := public.progress_nat(op, 'xp', 10000);
      b := public.progress_nat(op, 'coins', 100000);
      if a is null or b is null then v_st := 'rejected_invalid';
      else c := c || jsonb_build_object('xp', (c ->> 'xp')::bigint + a, 'coins', (c ->> 'coins')::bigint + b,
                                        'totalCoinsEarned', (c ->> 'totalCoinsEarned')::bigint + b); end if;

    elsif v_kind = 'use' then
      v_item := op ->> 'item';
      if v_item = 'hint' then c := c || jsonb_build_object('hints', greatest(0, (c ->> 'hints')::bigint - 1));
      elsif v_item = 'shield' then c := c || jsonb_build_object('comboShields', greatest(0, (c ->> 'comboShields')::bigint - 1));
      else v_st := 'rejected_invalid'; end if;

    elsif v_kind = 'skip' then
      -- діагностика: уроки вважаються відомими без нагороди (у список нагороджених не йдуть)
      if jsonb_typeof(op -> 'lessons') <> 'array' or jsonb_array_length(op -> 'lessons') > 400 then v_st := 'rejected_invalid';
      else c := c || jsonb_build_object('completed', to_jsonb(public.progress_union(v_done, public.progress_texts(op -> 'lessons')))); end if;

    elsif v_kind = 'init' then
      -- перенесення: локальний стан як початковий. Лише один раз і лише коли на сервері ще нічого не було.
      if jsonb_typeof(op -> 'state') <> 'object' then v_st := 'rejected_invalid';
      elsif not v_pristine or v_changed then v_st := 'rejected_exists';
      else
        c := public.progress_core_from_state(op -> 'state');
        rw := public.progress_texts(c -> 'completed');
      end if;

    else
      v_st := 'rejected_invalid';
    end if;

    insert into public.progress_ops (user_id, op_id, kind, status, payload, created_at)
    values (uid, v_id, coalesce(v_kind, '?'), v_st, case when v_kind = 'init' then jsonb_build_object('opId', v_id, 'kind', 'init') else op end, t);
    v_changed := true;
    v_res := v_res || jsonb_build_object('opId', v_id, 'status', v_st, 'duplicate', false);
  end loop;

  v_state := r.state;
  v_rev := r.rev;
  if p_client_state is not null then
    if jsonb_typeof(p_client_state) <> 'object' then v_cs := 'rejected_invalid';
    elsif p_base_rev is not distinct from r.rev then
      v_state := p_client_state;
      v_cs := 'saved';
      v_changed := true;
    else
      v_cs := 'client_state_conflict';                    -- знімок зі старою версією нічого не затирає
    end if;
  end if;

  if v_changed then
    v_rev := r.rev + 1;
    v_state := v_state || c;                              -- state завжди повний знімок (клієнтська частина + ядро): його бачить і старий спосіб
    update public.progress p
       set state = v_state, core = c, rewarded = rw, rev = v_rev, updated_at = t,
           answers_total = (c ->> 'answersTotal')::int,
           answers_correct = least((c ->> 'answersCorrect')::int, (c ->> 'answersTotal')::int)
     where p.user_id = uid;
  end if;

  return jsonb_build_object(
    'status', 'ok', 'mode', 'v2', 'rev', v_rev, 'core', c, 'rewarded', to_jsonb(rw),
    'client_state', v_state, 'client_state_status', v_cs, 'ops', v_res,
    'updated_ms', (extract(epoch from (case when v_changed then t else r.updated_at end)) * 1000)::bigint);
end
$$;

-- Завантаження для нової збірки: режим, версія, ядро, список нагороджених і повний знімок. Працює в обох режимах.
create or replace function public.load_progress_v2() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid    uuid := public.my_allowed_id();
  v_mode text;
  r      public.progress;
  c      jsonb;
begin
  if uid is null then raise exception 'session_replaced'; end if;
  select s.write_mode into v_mode from public.progress_settings s where s.id;
  select * into r from public.progress p where p.user_id = uid;
  if not found then
    return jsonb_build_object('mode', v_mode, 'exists', false, 'rev', 0, 'core', public.progress_core_from_state('{}'::jsonb),
                              'rewarded', '[]'::jsonb, 'state', null, 'updated_ms', null);
  end if;
  -- у режимі legacy пише старий спосіб, тож ядро беремо зі state; у v2 з колонки ядра
  c := case when v_mode = 'v2' then coalesce(r.core, public.progress_core_from_state(r.state)) else public.progress_core_from_state(r.state) end;
  return jsonb_build_object(
    'mode', v_mode, 'exists', true, 'rev', r.rev, 'core', c,
    'rewarded', to_jsonb(case when v_mode = 'v2' then r.rewarded else public.progress_union(r.rewarded, public.progress_texts(c -> 'completed')) end),
    'state', r.state, 'updated_ms', (extract(epoch from r.updated_at) * 1000)::bigint);
end
$$;

-- ───────── Перемикання режиму (лише власник: SQL Editor або service_role) ─────────
-- → 'v2': ядро кожного рядка збирається з ПОТОЧНОГО state (запис старим способом між кроком 1 і перемиканням потрапляє в ядро);
--          список нагороджених = журнал ∪ state.completed; rev + 1; нічого не нараховується.
-- → 'legacy' (відкат): лише зміна режиму. v2 весь час тримає в state повний знімок, тож старий спосіб бачить повні дані.
-- Повторний перехід у 'v2' робить те саме, що перший; журнал зберігається, тож повтор старого opId дає попередній підсумок.
create or replace function public.set_progress_write_mode(p_mode text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev text;
  v_rows int := 0;
begin
  if not (session_user in ('postgres', 'supabase_admin') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'forbidden';
  end if;
  if p_mode is null or p_mode not in ('legacy', 'v2') then raise exception 'bad_mode'; end if;

  perform pg_advisory_xact_lock(701001);                  -- виключне: чекає завершення всіх запитів запису й не пускає нові
  select s.write_mode into v_prev from public.progress_settings s where s.id for update;
  if v_prev = p_mode then
    return jsonb_build_object('mode', p_mode, 'previous', v_prev, 'changed', false, 'rows', 0);
  end if;

  if p_mode = 'v2' then
    update public.progress p
       set core = k.core,
           state = p.state || k.core,
           rewarded = public.progress_union(
                        public.progress_union(p.rewarded, public.progress_texts(k.core -> 'completed')),
                        array(select j.payload ->> 'lessonId' from public.progress_ops j
                               where j.user_id = p.user_id and j.kind = 'lesson' and j.status in ('applied', 'already_rewarded')
                                 and j.payload -> 'repeatable' is distinct from 'true'::jsonb
                                 and j.payload ->> 'lessonId' is not null)),
           rev = p.rev + 1,
           answers_total = (k.core ->> 'answersTotal')::int,
           answers_correct = (k.core ->> 'answersCorrect')::int
      from (select q.user_id, public.progress_core_from_state(q.state) as core from public.progress q) k
     where k.user_id = p.user_id;
    get diagnostics v_rows = row_count;
  end if;

  update public.progress_settings s set write_mode = p_mode, changed_at = now() where s.id;
  insert into public.progress_mode_log (mode, previous, rows_count, changed_by) values (p_mode, v_prev, v_rows, session_user);
  return jsonb_build_object('mode', p_mode, 'previous', v_prev, 'changed', true, 'rows', v_rows);
end
$$;

-- ───────── Перенесення наявних рядків (одноразово; повторний запуск файла їх не чіпає) ─────────
-- rev = 1, ядро з поточного state, список нагороджених = поточний completed. Нічого не нараховується.
update public.progress p
   set rev = 1,
       core = public.progress_core_from_state(p.state),
       rewarded = public.progress_texts(p.state -> 'completed')
 where p.rev = 0;

-- ───────── Права ─────────
revoke execute on function public.save_progress_v2(bigint, jsonb, jsonb, int), public.load_progress_v2(), public.set_progress_write_mode(text),
  public.save_progress(jsonb) from public, anon;
grant execute on function public.save_progress_v2(bigint, jsonb, jsonb, int), public.load_progress_v2(), public.save_progress(jsonb) to authenticated;
revoke execute on function public.set_progress_write_mode(text) from authenticated;
grant execute on function public.set_progress_write_mode(text) to service_role;
