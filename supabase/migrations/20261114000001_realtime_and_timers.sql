-- Stage 5: live updates, turn timers, sitting out, and scheduled maintenance.

-- ---------------------------------------------------------------------------
-- Sitting out: a player whose turn timer runs out is marked as sitting out.
-- They keep their seat and chips but are not dealt in until they return.
-- ---------------------------------------------------------------------------
alter table public.table_seats drop constraint table_seats_status_check;
alter table public.table_seats
  add constraint table_seats_status_check
  check (status in ('active', 'sitting_out', 'leaving'));
alter table public.table_seats add column away_since timestamptz;

-- ---------------------------------------------------------------------------
-- One change feed per table. Every seat change bumps the table's state row,
-- so clients only need to listen to table_state to know something happened.
-- ---------------------------------------------------------------------------
alter table public.table_state add column seats_rev integer not null default 0;

create function private.touch_table_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.table_state
     set seats_rev = seats_rev + 1, updated_at = now()
   where table_id = coalesce(new.table_id, old.table_id);
  return null;
end;
$$;

create trigger table_seats_touch_state
  after insert or update or delete on public.table_seats
  for each row execute function private.touch_table_state();

-- ---------------------------------------------------------------------------
-- game_load now also returns the turn deadline and when the last hand ended,
-- which the server needs to enforce timers and the pause between hands.
-- ---------------------------------------------------------------------------
create or replace function public.game_load(p_key text, p_table_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_server_key(p_key);
  return (
    select jsonb_build_object(
      'now', now(),
      'table', to_jsonb(t),
      'seats', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'seat_no', s.seat_no, 'user_id', s.user_id,
                 'stack', s.stack, 'status', s.status) order by s.seat_no)
          from public.table_seats s where s.table_id = t.id), '[]'::jsonb),
      'hand', (
        select jsonb_build_object(
                 'id', h.id, 'hand_number', h.hand_number, 'version', h.version,
                 'state', h.state, 'updated_at', h.updated_at)
          from private.hands h
         where h.table_id = t.id and h.status = 'active'),
      'turn_deadline', (select ts.turn_deadline from public.table_state ts where ts.table_id = t.id),
      'last_hand_ended_at', (
        select h.updated_at from private.hands h
         where h.id = t.current_hand_id and h.status <> 'active')
    )
    from public.poker_tables t
   where t.id = p_table_id
  );
end;
$$;

-- The game server marks a player as sitting out when their timer expires.
create function public.game_set_sitting_out(p_key text, p_table_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_server_key(p_key);
  update public.table_seats
     set status = 'sitting_out', away_since = now()
   where table_id = p_table_id and user_id = p_user_id and status = 'active';
end;
$$;

-- "I'm back": the caller returns to play from the next hand.
create function public.sit_in(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.table_seats
     set status = 'active', away_since = null
   where table_id = p_table_id and user_id = auth.uid() and status = 'sitting_out';
  if not found then
    raise exception 'not_seated';
  end if;
end;
$$;

revoke all on function public.game_set_sitting_out(text, uuid, uuid), public.sit_in(uuid)
  from public, anon, authenticated;
grant execute on function public.game_set_sitting_out(text, uuid, uuid) to anon, authenticated;
grant execute on function public.sit_in(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Scheduled maintenance. Runs inside the database, so it works even when
-- nobody is connected:
--   * cancels hands nobody has touched for 3 minutes (chips are restored);
--   * removes players who have been sitting out for 15 minutes (cashed out);
--   * closes empty tables that have been idle for an hour.
-- ---------------------------------------------------------------------------
create function public.table_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aborted integer;
  v_removed integer := 0;
  v_closed  integer;
  v_seat    record;
begin
  v_aborted := public.abort_stale_hands(interval '3 minutes');

  for v_seat in
    select s.table_id, s.user_id
      from public.table_seats s
     where s.status = 'sitting_out'
       and s.away_since < now() - interval '15 minutes'
       and not exists (
         select 1 from private.hands h
          where h.table_id = s.table_id and h.status = 'active')
  loop
    update public.table_seats set status = 'leaving'
     where table_id = v_seat.table_id and user_id = v_seat.user_id;
    perform private.settle_seats(v_seat.table_id);
    v_removed := v_removed + 1;
  end loop;

  update public.poker_tables t
     set status = 'closed'
   where t.status = 'open'
     and t.updated_at < now() - interval '1 hour'
     and not exists (select 1 from public.table_seats s where s.table_id = t.id)
     and not exists (
       select 1 from public.table_state ts
        where ts.table_id = t.id and ts.updated_at > now() - interval '1 hour');
  get diagnostics v_closed = row_count;

  return jsonb_build_object('aborted_hands', v_aborted, 'removed_seats', v_removed, 'closed_tables', v_closed);
end;
$$;

revoke all on function public.table_maintenance() from public, anon, authenticated;
grant execute on function public.table_maintenance() to service_role;

-- Run it every minute with pg_cron where that extension is available
-- (it is on Supabase; a plain local Postgres used for tests may not have it).
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule(jobid) from cron.job where jobname = 'zagoker-table-maintenance';
    perform cron.schedule('zagoker-table-maintenance', '* * * * *', 'select public.table_maintenance()');
  else
    raise notice 'pg_cron is not available: schedule public.table_maintenance() another way';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Live updates: publish table_state changes through Supabase Realtime.
-- Row Level Security still applies, so a client only receives changes for
-- tables it is allowed to see. The row holds the public view only.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.table_state;
  else
    raise notice 'supabase_realtime publication not found: skipping';
  end if;
end;
$$;
