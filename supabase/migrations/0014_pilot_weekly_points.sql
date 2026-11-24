-- Залік закритого тесту: прийняті сервером перші проходження після ввімкнення.
-- Окрема перевірка відповідей може замінити це джерело балів без зміни журналу й екрана ліги.
create or replace function public.credit_pilot_league_lesson()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- save_progress_v2 записує час поточної транзакції. Відновлення архіву повертає початковий час.
  if new.created_at <> transaction_timestamp()
    or (new.payload -> 'repeatable') = 'true'::jsonb
    or new.op_id like 'legacy:%' then
    return null;
  end if;

  -- save_progress_v2 вже звірив епоху й тримає спільне блокування учасника до кінця транзакції.
  insert into public.league_lesson_credits (user_id, progress_epoch, lesson_id, source_op_id, accepted_at)
  select a.id, a.progress_epoch, eligible.lesson_id, new.op_id, new.created_at
    from public.allowed_users a
    join public.league_eligible_lessons eligible on eligible.lesson_id = new.payload ->> 'lessonId'
   where a.id = new.user_id and a.status = 'active' and not a.is_service
  on conflict (user_id, progress_epoch, lesson_id) do nothing;

  return null;
end;
$$;

revoke all on function public.credit_pilot_league_lesson() from public, anon, authenticated, service_role;

drop trigger if exists credit_pilot_league_lesson on public.progress_ops;
create trigger credit_pilot_league_lesson
  after insert on public.progress_ops
  for each row when (new.kind = 'lesson' and new.status = 'applied')
  execute function public.credit_pilot_league_lesson();
