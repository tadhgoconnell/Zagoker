-- Table clean-up. Safe to run more than once.
--
--   * A table is deleted (closed for good, everyone cashed out) once nobody
--     has used it for 30 minutes. "Using" means a seated player, or the host,
--     has the table open on their screen: the table screen checks in every
--     15 seconds while it is open.
--   * Replaces the old rule (empty tables closed after an hour of silence).
--   * Hosts delete their own tables with close_table, now also from the
--     lobby. Nothing about that function changes.
--
-- Chips are never lost: a deleted table returns every seat's stack to its
-- player, exactly as when the host closes it. Hands still being played are
-- never touched; abandoned hands are cancelled first (bets returned) by the
-- existing 3-minute rule.

create table if not exists private.table_activity (
  table_id     uuid primary key references public.poker_tables (id) on delete cascade,
  last_seen_at timestamptz not null default now()
);
alter table private.table_activity enable row level security;
revoke all on private.table_activity from public;
revoke all on private.table_activity from anon;
revoke all on private.table_activity from authenticated;

-- Tables already open start their 30 minutes now, not from when they were
-- created, so nobody's game is cut short when this file is run.
insert into private.table_activity (table_id)
  select id from public.poker_tables where status = 'open'
on conflict (table_id) do nothing;

-- Called by the table screen while it is open. Counts only for the host and
-- seated players; anyone else is ignored. Writes at most every 30 seconds.
create or replace function public.mark_table_active(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.poker_tables t
     where t.id = p_table_id
       and t.status = 'open'
       and (
         t.owner_id = (select auth.uid())
         or exists (
           select 1 from public.table_seats s
            where s.table_id = t.id and s.user_id = (select auth.uid())
         )
       )
  ) then
    return;
  end if;
  insert into private.table_activity as a (table_id, last_seen_at)
  values (p_table_id, now())
  on conflict (table_id) do update
     set last_seen_at = now()
   where a.last_seen_at < now() - interval '30 seconds';
end;
$$;

-- Cash everyone out and close the table. No ownership check: only for the
-- maintenance job. The caller makes sure no hand is being played.
create or replace function private.close_table_now(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.table_seats set status = 'leaving' where table_id = p_table_id;
  perform private.settle_seats(p_table_id);
  update public.poker_tables set status = 'closed' where id = p_table_id;
end;
$$;

create or replace function public.table_maintenance()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_aborted integer;
  v_removed integer := 0;
  v_closed  integer := 0;
  v_seat    record;
  v_table   record;
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

  -- Tables nobody has had open for 30 minutes.
  for v_table in
    select t.id
      from public.poker_tables t
      left join private.table_activity a on a.table_id = t.id
     where t.status = 'open'
       and coalesce(a.last_seen_at, t.created_at) < now() - interval '30 minutes'
       and t.created_at < now() - interval '30 minutes'
       and not exists (
         select 1 from private.hands h
          where h.table_id = t.id and h.status = 'active')
       for update of t skip locked
  loop
    perform private.close_table_now(v_table.id);
    v_closed := v_closed + 1;
  end loop;

  return jsonb_build_object('aborted_hands', v_aborted, 'removed_seats', v_removed, 'closed_tables', v_closed);
end;
$$;

revoke all on function public.mark_table_active(uuid) from public;
revoke all on function public.mark_table_active(uuid) from anon;
revoke all on function public.mark_table_active(uuid) from authenticated;
grant execute on function public.mark_table_active(uuid) to authenticated;
revoke all on function private.close_table_now(uuid) from public;
revoke all on function private.close_table_now(uuid) from anon;
revoke all on function private.close_table_now(uuid) from authenticated;
revoke all on function public.table_maintenance() from public;
revoke all on function public.table_maintenance() from anon;
revoke all on function public.table_maintenance() from authenticated;
