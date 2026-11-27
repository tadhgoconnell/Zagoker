-- Blackjack and roulette against the house. Safe to run more than once.
--
--   * Chips come from, and go back to, the same balance as the poker tables
--     (profiles.chips), through apply_chip_delta, so every bet and every
--     payout is in the chip history (kinds casino_bet and casino_payout).
--   * The game server runs the rules and calls these functions with the game
--     server key, exactly like the game_* poker functions. Browsers cannot
--     call them usefully and cannot read the rounds (the shoe is secret).
--   * Bets are 10 to 5,000 chips per blackjack hand or roulette spin.
--   * A blackjack hand left unfinished stays open: the player picks it up
--     where they left off. No chips are lost.

alter table public.chip_transactions drop constraint if exists chip_transactions_kind_check;
alter table public.chip_transactions add constraint chip_transactions_kind_check
  check (kind in ('signup_bonus', 'daily_bonus', 'table_buy_in', 'table_cash_out', 'adjustment',
                  'casino_bet', 'casino_payout'));

create table if not exists private.casino_rounds (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game       text not null check (game in ('blackjack', 'roulette')),
  status     text not null check (status in ('active', 'settled')),
  staked     bigint not null check (staked > 0 and staked <= 40000),
  payout     bigint not null default 0 check (payout >= 0),
  version    integer not null default 0,
  state      jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint casino_rounds_payout_limit check (payout <= staked * 36)
);
-- One unfinished round per player and game.
create unique index if not exists casino_rounds_one_active
  on private.casino_rounds (user_id, game) where status = 'active';
create index if not exists casino_rounds_user_created
  on private.casino_rounds (user_id, created_at desc);
alter table private.casino_rounds enable row level security;
revoke all on private.casino_rounds from public;
revoke all on private.casino_rounds from anon;
revoke all on private.casino_rounds from authenticated;

-- The player's unfinished blackjack round, or null.
create or replace function public.casino_load(p_key text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_server_key(p_key);
  return (
    select jsonb_build_object('id', r.id, 'version', r.version, 'state', r.state)
      from private.casino_rounds r
     where r.user_id = p_user_id and r.game = 'blackjack' and r.status = 'active'
  );
end;
$$;

-- Takes the stake and stores a new round. With a payout (roulette, or a
-- blackjack decided on the deal) the round is settled and paid at once.
create or replace function public.casino_start(
  p_key     text,
  p_user_id uuid,
  p_game    text,
  p_stake   bigint,
  p_state   jsonb,
  p_payout  bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform private.assert_server_key(p_key);
  if p_stake is null or p_stake < 10 or p_stake > 5000 then
    raise exception 'invalid_bet';
  end if;
  insert into private.casino_rounds (user_id, game, status, staked, payout, state)
  values (p_user_id, p_game, case when p_payout is null then 'active' else 'settled' end,
          p_stake, coalesce(p_payout, 0), p_state)
  returning id into v_id;
  perform public.apply_chip_delta(p_user_id, -p_stake, 'casino_bet', v_id);
  if p_payout > 0 then
    perform public.apply_chip_delta(p_user_id, p_payout, 'casino_payout', v_id);
  end if;
  return v_id;
end;
$$;

-- Saves a move. A double or split takes its extra stake here.
create or replace function public.casino_update(
  p_key      text,
  p_round_id uuid,
  p_version  integer,
  p_state    jsonb,
  p_extra    bigint
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round private.casino_rounds;
begin
  perform private.assert_server_key(p_key);
  select * into v_round from private.casino_rounds where id = p_round_id for update;
  if not found or v_round.status <> 'active' then
    raise exception 'no_round';
  end if;
  if v_round.version <> p_version then
    raise exception 'stale_version';
  end if;
  if p_extra < 0 then
    raise exception 'invalid_bet';
  end if;
  if p_extra > 0 then
    perform public.apply_chip_delta(v_round.user_id, -p_extra, 'casino_bet', p_round_id);
  end if;
  update private.casino_rounds
     set state = p_state, staked = staked + p_extra, version = version + 1, updated_at = now()
   where id = p_round_id;
  return v_round.version + 1;
end;
$$;

-- Ends a round and pays the player.
create or replace function public.casino_settle(
  p_key      text,
  p_round_id uuid,
  p_version  integer,
  p_state    jsonb,
  p_payout   bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_round private.casino_rounds;
begin
  perform private.assert_server_key(p_key);
  select * into v_round from private.casino_rounds where id = p_round_id for update;
  if not found or v_round.status <> 'active' then
    raise exception 'no_round';
  end if;
  if v_round.version <> p_version then
    raise exception 'stale_version';
  end if;
  if p_payout is null or p_payout < 0 then
    raise exception 'invalid_payout';
  end if;
  update private.casino_rounds
     set state = p_state, payout = p_payout, status = 'settled', version = version + 1, updated_at = now()
   where id = p_round_id;
  if p_payout > 0 then
    perform public.apply_chip_delta(v_round.user_id, p_payout, 'casino_payout', p_round_id);
  end if;
end;
$$;

revoke all on function public.casino_load(text, uuid) from public;
revoke all on function public.casino_start(text, uuid, text, bigint, jsonb, bigint) from public;
revoke all on function public.casino_update(text, uuid, integer, jsonb, bigint) from public;
revoke all on function public.casino_settle(text, uuid, integer, jsonb, bigint) from public;
-- Like the game_* functions: callable by the API roles, useless without the key.
grant execute on function public.casino_load(text, uuid) to anon;
grant execute on function public.casino_load(text, uuid) to authenticated;
grant execute on function public.casino_start(text, uuid, text, bigint, jsonb, bigint) to anon;
grant execute on function public.casino_start(text, uuid, text, bigint, jsonb, bigint) to authenticated;
grant execute on function public.casino_update(text, uuid, integer, jsonb, bigint) to anon;
grant execute on function public.casino_update(text, uuid, integer, jsonb, bigint) to authenticated;
grant execute on function public.casino_settle(text, uuid, integer, jsonb, bigint) to anon;
grant execute on function public.casino_settle(text, uuid, integer, jsonb, bigint) to authenticated;
