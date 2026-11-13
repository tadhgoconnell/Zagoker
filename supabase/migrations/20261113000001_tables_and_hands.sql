-- Stage 4: poker tables, seats, hands, actions and chip settlement.
--
-- Trust model
--   * Players (the `authenticated` role) can read tables they are allowed to
--     see and can call a few functions that act only on themselves:
--     create_table, join_table, leave_table, close_table, get_my_hole_cards.
--   * The deck and every player's hole cards live in the `private` schema,
--     which the API does not expose and no client role can read.
--   * The game server proves who it is with a "game server key". Only the
--     SHA-256 hash of that key is stored. The game_* functions refuse to run
--     without it, so they are the only way a hand can be started, advanced or
--     settled. The key unlocks nothing else in the database.
--   * While a hand is being played, bets exist only inside the private hand
--     state. Seat stacks change once, atomically, when the hand is settled.
--     A hand that is abandoned or aborted therefore cannot lose anyone chips.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Game server keys
-- ---------------------------------------------------------------------------
create table private.server_keys (
  key_hash   bytea primary key,
  label      text not null,
  created_at timestamptz not null default now()
);

create function private.assert_server_key(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key is null or not exists (
    select 1 from private.server_keys
     where key_hash = sha256(convert_to(p_key, 'UTF8'))
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.poker_tables (
  id              uuid primary key default gen_random_uuid(),
  name            text not null check (char_length(name) between 3 and 40),
  owner_id        uuid not null references public.profiles (id) on delete cascade,
  is_private      boolean not null default false,
  room_code       text not null unique,
  max_players     integer not null check (max_players between 2 and 9),
  small_blind     bigint not null check (small_blind > 0),
  big_blind       bigint not null,
  buy_in          bigint not null,
  status          text not null default 'open' check (status in ('open', 'closed')),
  dealer_seat     integer,
  hand_number     integer not null default 0,
  current_hand_id uuid,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (big_blind >= small_blind and big_blind <= 1000000),
  check (buy_in between big_blind * 10 and big_blind * 1000)
);

create index poker_tables_lobby_idx
  on public.poker_tables (created_at desc) where status = 'open' and not is_private;

create trigger poker_tables_touch_updated_at
  before update on public.poker_tables
  for each row execute function public.touch_updated_at();

-- One row per occupied seat. `stack` is the player's chips at the table as of
-- the last settled hand; the live stack during a hand is in table_state.view.
create table public.table_seats (
  table_id  uuid not null references public.poker_tables (id) on delete cascade,
  seat_no   integer not null check (seat_no between 0 and 8),
  user_id   uuid not null references public.profiles (id) on delete cascade,
  stack     bigint not null check (stack >= 0),
  status    text not null default 'active' check (status in ('active', 'leaving')),
  joined_at timestamptz not null default now(),
  primary key (table_id, seat_no),
  -- A player sits at one table at a time.
  unique (user_id)
);

-- What everyone at the table may see: the public view of the current hand.
create table public.table_state (
  table_id      uuid primary key references public.poker_tables (id) on delete cascade,
  hand_id       uuid,
  hand_number   integer not null default 0,
  version       integer not null default 0,
  view          jsonb,
  turn_deadline timestamptz,
  updated_at    timestamptz not null default now()
);

-- Every action of every hand, in order.
create table public.hand_actions (
  id          bigint generated always as identity primary key,
  hand_id     uuid not null,
  table_id    uuid not null references public.poker_tables (id) on delete cascade,
  hand_number integer not null,
  seq         integer not null,
  seat_no     integer not null,
  user_id     uuid,
  action      text not null,
  amount      bigint not null default 0,
  street      text not null,
  created_at  timestamptz not null default now(),
  unique (hand_id, seq)
);

-- Outcome of each finished hand (hand history).
create table public.hand_history (
  hand_id     uuid primary key,
  table_id    uuid not null references public.poker_tables (id) on delete cascade,
  hand_number integer not null,
  board       jsonb not null,
  players     jsonb not null,
  result      jsonb not null,
  ended_at    timestamptz not null default now()
);

create index hand_history_table_idx on public.hand_history (table_id, hand_number desc);

-- ---------------------------------------------------------------------------
-- Secret game state. Never readable by clients.
-- ---------------------------------------------------------------------------
create table private.hands (
  id              uuid primary key default gen_random_uuid(),
  table_id        uuid not null references public.poker_tables (id) on delete cascade,
  hand_number     integer not null,
  status          text not null default 'active' check (status in ('active', 'complete', 'aborted')),
  version         integer not null default 0,
  state           jsonb not null,
  starting_stacks jsonb not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (table_id, hand_number)
);

-- At most one hand in progress per table, enforced by the database.
create unique index hands_one_active_per_table_idx
  on private.hands (table_id) where status = 'active';

create table private.hand_cards (
  hand_id uuid not null references private.hands (id) on delete cascade,
  user_id uuid not null,
  seat_no integer not null,
  cards   jsonb not null,
  primary key (hand_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Can the calling user see this table? Public tables: any signed-in user.
-- Private tables: the owner and seated players only.
create function public.can_view_table(p_table_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.poker_tables t
     where t.id = p_table_id
       and (select auth.uid()) is not null
       and (
         not t.is_private
         or t.owner_id = (select auth.uid())
         or exists (
           select 1 from public.table_seats s
            where s.table_id = t.id and s.user_id = (select auth.uid())
         )
       )
  );
$$;

-- Eight characters from an alphabet without look-alikes (no 0/O, 1/I/L).
-- gen_random_uuid() draws from the server's cryptographic random source.
create function private.generate_room_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  c_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 symbols
  v_bytes bytea := uuid_send(gen_random_uuid());
  v_code  text := '';
  v_i     integer := 0;
  v_b     integer;
begin
  while char_length(v_code) < 8 loop
    if v_i >= 16 then
      v_bytes := uuid_send(gen_random_uuid());
      v_i := 0;
    end if;
    v_b := get_byte(v_bytes, v_i);
    -- Bytes 6 and 8 of a UUID carry fixed version bits, so skip them, and
    -- reject values >= 248 so every symbol is equally likely.
    if v_i not in (6, 8) and v_b < 248 then
      v_code := v_code || substr(c_alphabet, (v_b % 31) + 1, 1);
    end if;
    v_i := v_i + 1;
  end loop;
  return v_code;
end;
$$;

-- Removes players who asked to leave or who have no chips left, paying any
-- remaining stack back to their balance. Called whenever a hand ends.
create function private.settle_seats(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seat record;
begin
  for v_seat in
    select * from public.table_seats
     where table_id = p_table_id and (status = 'leaving' or stack = 0)
     for update
  loop
    if v_seat.stack > 0 then
      perform public.apply_chip_delta(v_seat.user_id, v_seat.stack, 'table_cash_out', p_table_id);
    end if;
    delete from public.table_seats
     where table_id = p_table_id and seat_no = v_seat.seat_no;
  end loop;
end;
$$;

-- Settles a finished hand: checks no chips were created or lost, writes the
-- final stacks, updates statistics and records the result. One transaction.
create function private.finish_hand(p_hand_id uuid, p_state jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hand  private.hands;
  v_start bigint;
  v_end   bigint;
begin
  select * into v_hand from private.hands where id = p_hand_id for update;

  select coalesce(sum(value::bigint), 0) into v_start
    from jsonb_each_text(v_hand.starting_stacks);
  select coalesce(sum((p ->> 'stack')::bigint), 0) into v_end
    from jsonb_array_elements(p_state -> 'players') p;

  if v_start <> v_end or exists (
    select 1 from jsonb_array_elements(p_state -> 'players') p
     where (p ->> 'stack')::bigint < 0
  ) then
    raise exception 'chip_conservation_violated: started with %, ended with %', v_start, v_end;
  end if;

  update public.table_seats s
     set stack = (p ->> 'stack')::bigint
    from jsonb_array_elements(p_state -> 'players') p
   where s.table_id = v_hand.table_id
     and s.seat_no = (p ->> 'seat')::integer
     and s.user_id = (p ->> 'id')::uuid;

  update public.player_stats ps
     set hands_played = ps.hands_played + 1,
         hands_won    = ps.hands_won
                        + case when coalesce((p_state #>> array['result', 'winnings', p ->> 'seat'])::bigint, 0) > 0 then 1 else 0 end,
         total_won    = ps.total_won
                        + greatest(coalesce((p_state #>> array['result', 'net', p ->> 'seat'])::bigint, 0), 0),
         biggest_pot  = greatest(ps.biggest_pot,
                                 coalesce((p_state #>> array['result', 'winnings', p ->> 'seat'])::bigint, 0))
    from jsonb_array_elements(p_state -> 'players') p
   where ps.user_id = (p ->> 'id')::uuid;

  update private.hands
     set status = 'complete', state = p_state, updated_at = now()
   where id = p_hand_id;

  insert into public.hand_history (hand_id, table_id, hand_number, board, players, result)
  values (
    p_hand_id, v_hand.table_id, v_hand.hand_number,
    p_state -> 'board',
    (select jsonb_agg(jsonb_build_object('seat', p -> 'seat', 'id', p -> 'id') order by (p ->> 'seat')::integer)
       from jsonb_array_elements(p_state -> 'players') p),
    p_state -> 'result'
  );

  perform private.settle_seats(v_hand.table_id);
end;
$$;

-- Appends engine action records to the public action log.
create function private.log_actions(p_hand private.hands, p_actions jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.hand_actions
    (hand_id, table_id, hand_number, seq, seat_no, user_id, action, amount, street)
  select p_hand.id, p_hand.table_id, p_hand.hand_number,
         coalesce((select max(seq) from public.hand_actions where hand_id = p_hand.id), 0) + a.ord,
         (a.value ->> 'seat')::integer,
         (select (pl ->> 'id')::uuid
            from jsonb_array_elements(p_hand.state -> 'players') pl
           where pl -> 'seat' = a.value -> 'seat'),
         a.value ->> 'type',
         (a.value ->> 'added')::bigint,
         a.value ->> 'street'
    from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb)) with ordinality as a(value, ord);
$$;

-- ---------------------------------------------------------------------------
-- Player functions (act as the signed-in user only)
-- ---------------------------------------------------------------------------

create function public.create_table(
  p_name        text,
  p_max_players integer,
  p_small_blind bigint,
  p_big_blind   bigint,
  p_buy_in      bigint,
  p_is_private  boolean
)
returns public.poker_tables
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_table public.poker_tables;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if (select count(*) from public.poker_tables where owner_id = v_user and status = 'open') >= 3 then
    raise exception 'too_many_tables';
  end if;

  -- Retry on the (astronomically unlikely) room-code collision.
  for attempt in 1..5 loop
    begin
      insert into public.poker_tables
        (name, owner_id, is_private, room_code, max_players, small_blind, big_blind, buy_in)
      values
        (btrim(p_name), v_user, coalesce(p_is_private, false), private.generate_room_code(),
         p_max_players, p_small_blind, p_big_blind, p_buy_in)
      returning * into v_table;
      exit;
    exception when unique_violation then
      if attempt = 5 then raise; end if;
    end;
  end loop;

  insert into public.table_state (table_id) values (v_table.id);
  return v_table;
end;
$$;

-- Looks a table up by its room code. This is how invited players find a
-- private table they cannot otherwise see.
create function public.get_table_by_code(p_room_code text)
returns table (
  id uuid, name text, is_private boolean, max_players integer,
  small_blind bigint, big_blind bigint, buy_in bigint, seated bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.is_private, t.max_players, t.small_blind, t.big_blind, t.buy_in,
         (select count(*) from public.table_seats s where s.table_id = t.id)
    from public.poker_tables t
   where (select auth.uid()) is not null
     and t.status = 'open'
     and t.room_code = upper(btrim(p_room_code));
$$;

-- Sits the caller down and moves the buy-in from their balance to the table.
create function public.join_table(
  p_table_id  uuid,
  p_seat_no   integer default null,
  p_room_code text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_table public.poker_tables;
  v_seat  integer := p_seat_no;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- Locking the table row makes concurrent joins queue up, so two players
  -- can never take the same seat or overfill the table.
  select * into v_table from public.poker_tables where id = p_table_id for update;
  if not found or v_table.status <> 'open' then
    raise exception 'table_not_found';
  end if;
  if v_table.is_private
     and v_table.owner_id <> v_user
     and (p_room_code is null or upper(btrim(p_room_code)) <> v_table.room_code) then
    raise exception 'invalid_room_code';
  end if;
  if exists (select 1 from public.table_seats where user_id = v_user) then
    raise exception 'already_seated';
  end if;

  if v_seat is null then
    select g into v_seat
      from generate_series(0, v_table.max_players - 1) g
     where not exists (
       select 1 from public.table_seats s where s.table_id = p_table_id and s.seat_no = g
     )
     order by g
     limit 1;
    if v_seat is null then
      raise exception 'table_full';
    end if;
  elsif v_seat < 0 or v_seat >= v_table.max_players then
    raise exception 'invalid_seat';
  elsif exists (select 1 from public.table_seats where table_id = p_table_id and seat_no = v_seat) then
    raise exception 'seat_taken';
  end if;

  -- Raises 'insufficient chips' and rolls everything back if they cannot afford it.
  perform public.apply_chip_delta(v_user, -v_table.buy_in, 'table_buy_in', p_table_id);

  insert into public.table_seats (table_id, seat_no, user_id, stack)
  values (p_table_id, v_seat, v_user, v_table.buy_in);

  return v_seat;
end;
$$;

-- Leaves the table. If the caller is in a hand that is still being played
-- they are marked as leaving and cashed out when it ends; otherwise their
-- stack goes back to their balance immediately.
create function public.leave_table(p_table_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_table public.poker_tables;
  v_seat  public.table_seats;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select * into v_table from public.poker_tables where id = p_table_id for update;
  select * into v_seat from public.table_seats
   where table_id = p_table_id and user_id = v_user for update;
  if not found then
    raise exception 'not_seated';
  end if;

  if exists (
    select 1
      from private.hands h
      join private.hand_cards c on c.hand_id = h.id
     where h.table_id = p_table_id and h.status = 'active' and c.user_id = v_user
  ) then
    update public.table_seats set status = 'leaving'
     where table_id = p_table_id and user_id = v_user;
    return 'leaving';
  end if;

  if v_seat.stack > 0 then
    perform public.apply_chip_delta(v_user, v_seat.stack, 'table_cash_out', p_table_id);
  end if;
  delete from public.table_seats where table_id = p_table_id and user_id = v_user;
  return 'left';
end;
$$;

-- Host control: closes the table and cashes everyone out. Not during a hand.
create function public.close_table(p_table_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.poker_tables;
begin
  select * into v_table from public.poker_tables where id = p_table_id for update;
  if not found or v_table.owner_id is distinct from auth.uid() then
    raise exception 'not_table_owner' using errcode = '42501';
  end if;
  if exists (select 1 from private.hands where table_id = p_table_id and status = 'active') then
    raise exception 'hand_in_progress';
  end if;

  update public.table_seats set status = 'leaving' where table_id = p_table_id;
  perform private.settle_seats(p_table_id);
  update public.poker_tables set status = 'closed' where id = p_table_id;
end;
$$;

-- The caller's own hole cards for the table's current hand. Nobody else's.
create function public.get_my_hole_cards(p_table_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select c.cards
    from public.poker_tables t
    join private.hand_cards c on c.hand_id = t.current_hand_id
   where t.id = p_table_id
     and c.user_id = (select auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Game server functions (require the game server key)
-- ---------------------------------------------------------------------------

-- Everything the server needs to run the next step at a table, including the
-- secret hand state.
create function public.game_load(p_key text, p_table_id uuid)
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
         where h.table_id = t.id and h.status = 'active')
    )
    from public.poker_tables t
   where t.id = p_table_id
  );
end;
$$;

-- Starts a hand. `p_expected_hand_number` is the table's hand number the
-- server saw when it dealt; if another request got there first it no longer
-- matches and this one is rejected, so a table can never have two hands.
create function public.game_start_hand(
  p_key                  text,
  p_table_id             uuid,
  p_expected_hand_number integer,
  p_state                jsonb,
  p_view                 jsonb,
  p_deadline             timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table public.poker_tables;
  v_hand  private.hands;
  v_p     jsonb;
  v_stack bigint;
begin
  perform private.assert_server_key(p_key);

  select * into v_table from public.poker_tables where id = p_table_id for update;
  if not found or v_table.status <> 'open' then
    raise exception 'table_not_found';
  end if;
  if v_table.hand_number <> p_expected_hand_number
     or exists (select 1 from private.hands where table_id = p_table_id and status = 'active') then
    raise exception 'stale_version';
  end if;

  -- The dealt-in players must be exactly who is sitting there, with the
  -- stacks the database holds. The server cannot invent chips.
  for v_p in select * from jsonb_array_elements(p_state -> 'players') loop
    select stack into v_stack
      from public.table_seats
     where table_id = p_table_id
       and seat_no = (v_p ->> 'seat')::integer
       and user_id = (v_p ->> 'id')::uuid
       and status = 'active';
    if not found then
      raise exception 'seat_mismatch';
    end if;
    if v_stack <> (p_state #>> array['startingStacks', v_p ->> 'seat'])::bigint then
      raise exception 'stack_mismatch';
    end if;
  end loop;
  if jsonb_array_length(p_state -> 'players') < 2 then
    raise exception 'not_enough_players';
  end if;

  insert into private.hands (table_id, hand_number, state, starting_stacks, version)
  values (p_table_id, v_table.hand_number + 1, p_state, p_state -> 'startingStacks',
          coalesce((p_state ->> 'version')::integer, 0))
  returning * into v_hand;

  insert into private.hand_cards (hand_id, user_id, seat_no, cards)
  select v_hand.id, (p ->> 'id')::uuid, (p ->> 'seat')::integer, p -> 'holeCards'
    from jsonb_array_elements(p_state -> 'players') p;

  update public.poker_tables
     set hand_number = v_hand.hand_number,
         dealer_seat = (p_state ->> 'dealerSeat')::integer,
         current_hand_id = v_hand.id
   where id = p_table_id;

  insert into public.table_state (table_id, hand_id, hand_number, version, view, turn_deadline, updated_at)
  values (p_table_id, v_hand.id, v_hand.hand_number, v_hand.version, p_view, p_deadline, now())
  on conflict (table_id) do update
     set hand_id = excluded.hand_id, hand_number = excluded.hand_number,
         version = excluded.version, view = excluded.view,
         turn_deadline = excluded.turn_deadline, updated_at = now();

  perform private.log_actions(v_hand, p_state -> 'actions');

  -- Possible when the blinds put every player all-in: the hand is already over.
  if jsonb_typeof(p_state -> 'result') = 'object' then
    perform private.finish_hand(v_hand.id, p_state);
  end if;

  return v_hand.id;
end;
$$;

-- Saves the state after one action. `p_expected_version` must be the version
-- the server loaded; a duplicate or conflicting request fails here and
-- changes nothing. When the new state contains a result, the hand is settled
-- in the same transaction.
create function public.game_commit(
  p_key              text,
  p_hand_id          uuid,
  p_expected_version integer,
  p_state            jsonb,
  p_view             jsonb,
  p_new_actions      jsonb,
  p_deadline         timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hand private.hands;
  v_new  integer := (p_state ->> 'version')::integer;
begin
  perform private.assert_server_key(p_key);

  select * into v_hand from private.hands where id = p_hand_id for update;
  if not found then
    raise exception 'hand_not_found';
  end if;
  if v_hand.status <> 'active' or v_hand.version <> p_expected_version then
    raise exception 'stale_version';
  end if;
  if v_new is null or v_new <= v_hand.version then
    raise exception 'version_must_increase';
  end if;

  update private.hands
     set state = p_state, version = v_new, updated_at = now()
   where id = p_hand_id;

  perform private.log_actions(v_hand, p_new_actions);

  update public.table_state
     set version = v_new, view = p_view, turn_deadline = p_deadline, updated_at = now()
   where table_id = v_hand.table_id;

  if jsonb_typeof(p_state -> 'result') = 'object' then
    perform private.finish_hand(p_hand_id, p_state);
  end if;

  return v_new;
end;
$$;

-- Cancels a hand in progress. Nobody loses chips: seat stacks were never
-- changed, so they are still what they were when the hand began.
create function private.abort_hand(p_hand_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hand private.hands;
begin
  select * into v_hand from private.hands where id = p_hand_id for update;
  if not found or v_hand.status <> 'active' then
    return false;
  end if;

  update private.hands set status = 'aborted', updated_at = now() where id = p_hand_id;
  update public.table_state
     set view = null, turn_deadline = null, version = version + 1, updated_at = now()
   where table_id = v_hand.table_id;
  perform private.settle_seats(v_hand.table_id);
  return true;
end;
$$;

create function public.game_abort_hand(p_key text, p_hand_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_server_key(p_key);
  return private.abort_hand(p_hand_id);
end;
$$;

-- Safety net for abandoned hands (server crash, everyone disconnected).
-- Intended to be run on a schedule by the database itself.
create function public.abort_stale_hands(p_idle interval default interval '10 minutes')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid;
  v_count integer := 0;
begin
  for v_id in
    select id from private.hands
     where status = 'active' and updated_at < now() - p_idle
  loop
    if private.abort_hand(v_id) then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security
-- ---------------------------------------------------------------------------
alter table public.poker_tables enable row level security;
alter table public.table_seats  enable row level security;
alter table public.table_state  enable row level security;
alter table public.hand_actions enable row level security;
alter table public.hand_history enable row level security;
alter table private.server_keys enable row level security;
alter table private.hands       enable row level security;
alter table private.hand_cards  enable row level security;

revoke all on public.poker_tables, public.table_seats, public.table_state,
              public.hand_actions, public.hand_history
  from anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;

-- Read-only for signed-in users, limited to tables they may see.
-- All changes go through the functions above.
grant select on public.poker_tables, public.table_seats, public.table_state,
                public.hand_actions, public.hand_history
  to authenticated;

create policy "Visible tables are readable" on public.poker_tables
  for select to authenticated using (public.can_view_table(id));
create policy "Seats of visible tables are readable" on public.table_seats
  for select to authenticated using (public.can_view_table(table_id));
create policy "State of visible tables is readable" on public.table_state
  for select to authenticated using (public.can_view_table(table_id));
create policy "Actions of visible tables are readable" on public.hand_actions
  for select to authenticated using (public.can_view_table(table_id));
create policy "History of visible tables is readable" on public.hand_history
  for select to authenticated using (public.can_view_table(table_id));

-- Function privileges. Start from nothing, then grant precisely.
revoke all on all functions in schema private from public, anon, authenticated;
revoke all on function
  public.can_view_table(uuid),
  public.create_table(text, integer, bigint, bigint, bigint, boolean),
  public.get_table_by_code(text),
  public.join_table(uuid, integer, text),
  public.leave_table(uuid),
  public.close_table(uuid),
  public.get_my_hole_cards(uuid),
  public.game_load(text, uuid),
  public.game_start_hand(text, uuid, integer, jsonb, jsonb, timestamptz),
  public.game_commit(text, uuid, integer, jsonb, jsonb, jsonb, timestamptz),
  public.game_abort_hand(text, uuid),
  public.abort_stale_hands(interval)
  from public, anon, authenticated;

grant execute on function
  public.can_view_table(uuid),
  public.create_table(text, integer, bigint, bigint, bigint, boolean),
  public.get_table_by_code(text),
  public.join_table(uuid, integer, text),
  public.leave_table(uuid),
  public.close_table(uuid),
  public.get_my_hole_cards(uuid)
  to authenticated;

-- The game server calls these without a user session, so they must be
-- reachable by `anon`. They are useless without the game server key.
grant execute on function
  public.game_load(text, uuid),
  public.game_start_hand(text, uuid, integer, jsonb, jsonb, timestamptz),
  public.game_commit(text, uuid, integer, jsonb, jsonb, jsonb, timestamptz),
  public.game_abort_hand(text, uuid)
  to anon, authenticated;

grant execute on function public.abort_stale_hands(interval) to service_role;
