-- ============================================================================
-- GRINDSET: скидання прогресу тестерів з епохою (ТЗ 005 / 007). Додається ПІСЛЯ 0001–0008, у режимі v2.
-- Як застосувати: локально — автотести supabase/sqltest; на продакшні — ЛИШЕ в погодженому вікні (SQL Editor → весь файл → Run).
-- Можна запускати повторно. Сама міграція НІЧОГО не скидає: скидання — окрема команда власника reset_progress(...).
--
-- Що робить:
--   1) епоха прогресу в записі учётки allowed_users.progress_epoch (переживає видалення прогресу);
--   2) архів progress_archive (рядок прогресу й журнал операцій до скидання) і журнал запусків progress_reset_runs;
--   3) save_progress_v2 приймає епоху: не та → нічого не пише, відповідь epoch_mismatch; load_progress_v2 повертає епоху;
--   4) стара save_progress (старі збірки) не пише для учёток, які вже скидались (епоха > 0) — у будь-якому режимі;
--   5) reset_progress(p_run_id, p_account_ids) і restore_progress(p_run_id, p_account_id) — лише власник (SQL Editor / service_role);
--   6) закриває зайві типові права Supabase, знайдені звіркою зі знімком продакшна (ТЗ 007, п. 0).
-- ============================================================================

-- ───────── 1. Епоха ─────────
alter table public.allowed_users add column if not exists progress_epoch int not null default 0;

-- ───────── 2. Архів і журнал запусків (без політик: лише функції власника) ─────────
create table if not exists public.progress_archive (
  id          bigint generated always as identity primary key,
  run_id      text not null,
  user_id     uuid not null,                       -- без зовнішнього ключа: архів переживає будь-які зміни учётки
  epoch       int not null,                        -- епоха, ДО якої належали дані
  kind        text not null check (kind in ('progress', 'op')),
  payload     jsonb not null,                      -- рядок progress або progress_ops цілком
  archived_at timestamptz not null default now()
);
create index if not exists progress_archive_run_idx on public.progress_archive (run_id, user_id);

create table if not exists public.progress_reset_runs (
  run_id     text not null,
  action     text not null check (action in ('reset', 'restore')),
  account_id uuid not null default '00000000-0000-0000-0000-000000000000', -- для restore — учётка; для reset — нульовий uuid
  result     jsonb not null,
  created_at timestamptz not null default now(),
  created_by text,
  primary key (run_id, action, account_id)
);

alter table public.progress_archive    enable row level security;
alter table public.progress_reset_runs enable row level security;
revoke all on public.progress_archive, public.progress_reset_runs from public, anon, authenticated;

-- ───────── 3. Запис: епоха перевіряється під блокуванням рядка учётки ─────────
-- Скидання бере виключне блокування того самого рядка (for update), запис — спільне (for share):
-- запис, що почався до скидання, або завершується до нього (і потрапляє в архів), або бачить нову епоху й відхиляється.
-- p_epoch = null — дані без позначки епохи (стара збірка b27 чи перенесення): початкова епоха 0.
-- Операції можуть нести власну епоху (op.epoch, перенесення legacy-init / legacy:<учётка>:<урок>): не та → rejected_epoch.
create or replace function public.save_progress_v2(p_base_rev bigint, p_ops jsonb, p_client_state jsonb, p_epoch int default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid       uuid := public.my_allowed_id();
  t         timestamptz := now();
  v_mode    text;
  v_epoch   int;
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
    return jsonb_build_object('status', 'not_active', 'mode', v_mode);
  end if;

  select a2.progress_epoch into v_epoch from public.allowed_users a2 where a2.id = uid for share;
  if coalesce(p_epoch, 0) <> v_epoch then
    return jsonb_build_object('status', 'epoch_mismatch', 'mode', v_mode, 'epoch', v_epoch);   -- нічого не пишемо
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

    if op ? 'epoch' and (jsonb_typeof(op -> 'epoch') <> 'number' or (op ->> 'epoch')::numeric <> v_epoch) then
      v_st := 'rejected_epoch';                          -- операція з даних іншої епохи (напр. перенесення старого знімка)

    elsif v_kind = 'lesson' then
      v_lesson := op ->> 'lessonId';
      a := public.progress_nat(op, 'xp', 10000);
      b := public.progress_nat(op, 'coins', 100000);
      if v_lesson is null or v_lesson !~ '^[A-Za-z0-9_:.-]{1,64}$' or a is null or b is null then
        v_st := 'rejected_invalid';
      elsif op -> 'repeatable' = 'true'::jsonb then
        c := c || jsonb_build_object('xp', (c ->> 'xp')::bigint + a, 'coins', (c ->> 'coins')::bigint + b,
                                     'totalCoinsEarned', (c ->> 'totalCoinsEarned')::bigint + b);
      elsif v_lesson = any (rw) then
        v_st := 'already_rewarded';
        if v_lesson <> all (v_done) then c := c || jsonb_build_object('completed', to_jsonb(v_done || v_lesson)); end if;
      else
        rw := rw || v_lesson;
        if v_lesson <> all (v_done) then v_done := v_done || v_lesson; end if;
        c := c || jsonb_build_object('completed', to_jsonb(v_done),
                                     'xp', (c ->> 'xp')::bigint + a, 'coins', (c ->> 'coins')::bigint + b,
                                     'totalCoinsEarned', (c ->> 'totalCoinsEarned')::bigint + b);
      end if;
      if v_st = 'applied' and op -> 'doubled' = 'true'::jsonb then
        c := c || jsonb_build_object('doubleCoins', greatest(0, (c ->> 'doubleCoins')::bigint - 1));
      end if;
      if v_st not in ('rejected_invalid', 'rejected_epoch') and op -> 'freezeUsed' = 'true'::jsonb then
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
      if jsonb_typeof(op -> 'lessons') <> 'array' or jsonb_array_length(op -> 'lessons') > 400 then v_st := 'rejected_invalid';
      else c := c || jsonb_build_object('completed', to_jsonb(public.progress_union(v_done, public.progress_texts(op -> 'lessons')))); end if;

    elsif v_kind = 'init' then
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
      v_cs := 'client_state_conflict';
    end if;
  end if;

  if v_changed then
    v_rev := r.rev + 1;
    v_state := v_state || c;
    update public.progress p
       set state = v_state, core = c, rewarded = rw, rev = v_rev, updated_at = t,
           answers_total = (c ->> 'answersTotal')::int,
           answers_correct = least((c ->> 'answersCorrect')::int, (c ->> 'answersTotal')::int)
     where p.user_id = uid;
  end if;

  return jsonb_build_object(
    'status', 'ok', 'mode', 'v2', 'epoch', v_epoch, 'rev', v_rev, 'core', c, 'rewarded', to_jsonb(rw),
    'client_state', v_state, 'client_state_status', v_cs, 'ops', v_res,
    'updated_ms', (extract(epoch from (case when v_changed then t else r.updated_at end)) * 1000)::bigint);
end
$$;

-- Завантаження: те саме, що в 0007, плюс епоха учётки
create or replace function public.load_progress_v2() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  uid     uuid := public.my_allowed_id();
  v_mode  text;
  v_epoch int;
  r       public.progress;
  c       jsonb;
begin
  if uid is null then raise exception 'session_replaced'; end if;
  select s.write_mode into v_mode from public.progress_settings s where s.id;
  select a.progress_epoch into v_epoch from public.allowed_users a where a.id = uid;
  select * into r from public.progress p where p.user_id = uid;
  if not found then
    return jsonb_build_object('mode', v_mode, 'epoch', v_epoch, 'exists', false, 'rev', 0, 'core', public.progress_core_from_state('{}'::jsonb),
                              'rewarded', '[]'::jsonb, 'state', null, 'updated_ms', null);
  end if;
  c := case when v_mode = 'v2' then coalesce(r.core, public.progress_core_from_state(r.state)) else public.progress_core_from_state(r.state) end;
  return jsonb_build_object(
    'mode', v_mode, 'epoch', v_epoch, 'exists', true, 'rev', r.rev, 'core', c,
    'rewarded', to_jsonb(case when v_mode = 'v2' then r.rewarded else public.progress_union(r.rewarded, public.progress_texts(c -> 'completed')) end),
    'state', r.state, 'updated_ms', (extract(epoch from r.updated_at) * 1000)::bigint);
end
$$;

-- ───────── 4. Стара збірка: після скидання учётки старий знімок не повертається жодним шляхом ─────────
-- Учётка, яку вже скидали (епоха > 0), старою save_progress нічого не записує (у тому числі після відкату в legacy):
-- стара збірка не знає епох і могла б повернути удалене зі свого пристрою. Учётки без скидання працюють, як у 0007.
create or replace function public.progress_legacy_blocked(p_uid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select a.progress_epoch > 0 from public.allowed_users a where a.id = p_uid), false)
$$;

do $$
declare
  src text;
begin
  -- додаємо перевірку епохи на початок наявної save_progress (тіло з 0007 не дублюємо): після перевірки сеансу
  select pg_get_functiondef('public.save_progress(jsonb)'::regprocedure) into src;
  if position('progress_legacy_blocked' in src) = 0 then
    src := replace(src,
      'if uid is null then raise exception ''session_replaced''; end if;',
      'if uid is null then raise exception ''session_replaced''; end if;' || chr(10) ||
      '  if public.progress_legacy_blocked(uid) then' || chr(10) ||
      '    insert into public.events (user_id, name, props, build) select uid, ''client_outdated'', jsonb_build_object(''via'', ''save_progress'', ''epoch'', true), null' || chr(10) ||
      '     where not exists (select 1 from public.events e where e.user_id = uid and e.name = ''client_outdated'' and e.created_at > now() - interval ''10 minutes'');' || chr(10) ||
      '    return 0;' || chr(10) ||
      '  end if;');
    -- захист від тихого пропуску: якщо рядок перевірки сеансу не знайдено (визначення відрізняється), міграція зупиняється
    if position('progress_legacy_blocked' in src) = 0 then
      raise exception 'save_progress_patch_failed: визначення save_progress не таке, як у 0007; 0009 не застосовано';
    end if;
    execute src;
  end if;
end
$$;

-- ───────── 5. Скидання й відновлення (лише власник) ─────────
-- reset_progress('<ідентифікатор запуску>', array['<id учётки>', …]::uuid[])
-- Одна транзакція. Лише в режимі v2. Явний непорожній список, варіанта «усі» немає. Повтор із тим самим ідентифікатором — той самий результат.
-- Для кожної учётки: прогрес і журнал операцій → progress_archive (епоха, запуск, час) → видалення → епоха + 1.
create or replace function public.reset_progress(p_run_id text, p_account_ids uuid[]) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev   jsonb;
  v_mode   text;
  v_ids    uuid[];
  v_id     uuid;
  v_user   public.allowed_users;
  v_res    jsonb := '[]'::jsonb;
  v_ap     int;
  v_ao     int;
  v_dp     int;
  v_do     int;
begin
  if not (session_user in ('postgres', 'supabase_admin') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'forbidden';
  end if;
  if p_run_id is null or p_run_id !~ '^[A-Za-z0-9_.:-]{1,64}$' then raise exception 'bad_run_id'; end if;

  perform pg_advisory_xact_lock(701002);                 -- запуски скидання / відновлення по черзі
  select r.result into v_prev from public.progress_reset_runs r where r.run_id = p_run_id and r.action = 'reset';
  if found then return v_prev || jsonb_build_object('repeated', true); end if;

  if p_account_ids is null or cardinality(p_account_ids) = 0 then raise exception 'empty_list'; end if;
  perform pg_advisory_xact_lock_shared(701001);          -- режим не перемкнеться посеред скидання
  select s.write_mode into v_mode from public.progress_settings s where s.id;
  if v_mode is distinct from 'v2' then raise exception 'reset_requires_v2'; end if;

  select array_agg(distinct x order by x) into v_ids from unnest(p_account_ids) x where x is not null;
  if v_ids is null then raise exception 'empty_list'; end if;
  foreach v_id in array v_ids loop
    -- виключне блокування рядка учётки: запис (for share) або завершився, або чекає й побачить нову епоху
    select * into v_user from public.allowed_users a where a.id = v_id for update;
    if not found then raise exception 'account_not_found: %', v_id; end if;

    insert into public.progress_archive (run_id, user_id, epoch, kind, payload)
      select p_run_id, v_id, v_user.progress_epoch, 'progress', to_jsonb(p) from public.progress p where p.user_id = v_id;
    get diagnostics v_ap = row_count;
    insert into public.progress_archive (run_id, user_id, epoch, kind, payload)
      select p_run_id, v_id, v_user.progress_epoch, 'op', to_jsonb(j) from public.progress_ops j where j.user_id = v_id;
    get diagnostics v_ao = row_count;
    delete from public.progress_ops j where j.user_id = v_id;
    get diagnostics v_do = row_count;
    delete from public.progress p where p.user_id = v_id;
    get diagnostics v_dp = row_count;
    update public.allowed_users a set progress_epoch = a.progress_epoch + 1 where a.id = v_id;

    v_res := v_res || jsonb_build_object('account', v_id, 'username', v_user.username, 'epoch_from', v_user.progress_epoch, 'epoch_to', v_user.progress_epoch + 1,
                                         'archived_progress', v_ap, 'archived_ops', v_ao, 'deleted_progress', v_dp, 'deleted_ops', v_do);
  end loop;

  v_prev := jsonb_build_object('run_id', p_run_id, 'accounts', v_res);
  insert into public.progress_reset_runs (run_id, action, result, created_by) values (p_run_id, 'reset', v_prev, session_user);
  return v_prev;
end
$$;

-- restore_progress('<ідентифікатор запуску скидання>', '<id учётки>')
-- Повертає рядок прогресу й журнал операцій з архіву цього запуску з новою епохою (епоха + 1): пристрої учётки очистяться
-- за розбіжністю епохи й завантажать відновлене. Поточний прогрес (якщо після скидання вже щось пройдено) теж іде в архів
-- з позначкою «<run_id>:before-restore». Повтор для тієї самої пари (запуск, учётка) — той самий результат.
create or replace function public.restore_progress(p_run_id text, p_account_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev  jsonb;
  v_user  public.allowed_users;
  v_row   jsonb;
  v_ops   int;
  v_mov   int;
begin
  if not (session_user in ('postgres', 'supabase_admin') or coalesce(auth.role(), '') = 'service_role') then
    raise exception 'forbidden';
  end if;
  if p_run_id is null or p_account_id is null then raise exception 'bad_args'; end if;

  perform pg_advisory_xact_lock(701002);
  select r.result into v_prev from public.progress_reset_runs r where r.run_id = p_run_id and r.action = 'restore' and r.account_id = p_account_id;
  if found then return v_prev || jsonb_build_object('repeated', true); end if;

  select * into v_user from public.allowed_users a where a.id = p_account_id for update;
  if not found then raise exception 'account_not_found'; end if;
  if not exists (select 1 from public.progress_archive x where x.run_id = p_run_id and x.user_id = p_account_id) then
    raise exception 'not_in_archive';
  end if;

  -- поточний прогрес після скидання — теж в архів, щоб нічого не загубити
  insert into public.progress_archive (run_id, user_id, epoch, kind, payload)
    select p_run_id || ':before-restore', p_account_id, v_user.progress_epoch, 'progress', to_jsonb(p) from public.progress p where p.user_id = p_account_id;
  get diagnostics v_mov = row_count;
  insert into public.progress_archive (run_id, user_id, epoch, kind, payload)
    select p_run_id || ':before-restore', p_account_id, v_user.progress_epoch, 'op', to_jsonb(j) from public.progress_ops j where j.user_id = p_account_id;
  delete from public.progress_ops j where j.user_id = p_account_id;
  delete from public.progress p where p.user_id = p_account_id;

  select x.payload into v_row from public.progress_archive x
   where x.run_id = p_run_id and x.user_id = p_account_id and x.kind = 'progress' order by x.id desc limit 1;
  if v_row is not null then
    insert into public.progress select * from jsonb_populate_record(null::public.progress, v_row || jsonb_build_object('updated_at', now()));
  end if;
  insert into public.progress_ops
    select (jsonb_populate_record(null::public.progress_ops, x.payload)).* from public.progress_archive x
     where x.run_id = p_run_id and x.user_id = p_account_id and x.kind = 'op'
  on conflict (user_id, op_id) do nothing;
  get diagnostics v_ops = row_count;
  update public.allowed_users a set progress_epoch = a.progress_epoch + 1 where a.id = p_account_id;

  v_prev := jsonb_build_object('run_id', p_run_id, 'account', p_account_id, 'username', v_user.username, 'epoch_to', v_user.progress_epoch + 1,
                               'restored_progress', (v_row is not null), 'restored_ops', v_ops, 'moved_current_progress', v_mov);
  insert into public.progress_reset_runs (run_id, action, account_id, result, created_by) values (p_run_id, 'restore', p_account_id, v_prev, session_user);
  return v_prev;
end
$$;

-- ───────── 6. Права ─────────
-- Нові функції: лише власник. Supabase за замовчуванням дає EXECUTE ролям anon / authenticated — відкликаємо явно.
revoke execute on function public.reset_progress(text, uuid[]), public.restore_progress(text, uuid), public.progress_legacy_blocked(uuid)
  from public, anon, authenticated;
grant execute on function public.reset_progress(text, uuid[]), public.restore_progress(text, uuid) to service_role;
revoke execute on function public.save_progress_v2(bigint, jsonb, jsonb, int), public.load_progress_v2() from public, anon;
grant execute on function public.save_progress_v2(bigint, jsonb, jsonb, int), public.load_progress_v2() to authenticated;

-- Зайві типові права, знайдені звіркою зі знімком продакшна (ТЗ 007, п. 0):
-- revoke_user_sessions — лише функція входу (service_role); тригерні функції напряму не викликаються.
revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
revoke execute on function public.events_fill(), public.feedback_fill() from public, anon, authenticated;
-- Таблиці: RLS і так закриває доступ, але прибираємо те, чого застосунку не треба (TRUNCATE / TRIGGER / REFERENCES, запис у службові).
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;
revoke insert, update, delete on public.keepalive from anon, authenticated;
revoke update, delete on public.events, public.feedback from authenticated;
revoke all on public.progress, public.login_throttle from anon, authenticated;
