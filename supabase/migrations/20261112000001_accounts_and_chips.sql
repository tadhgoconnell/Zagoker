-- Stage 2: accounts, virtual chip balances, chip ledger, player statistics.
--
-- Security model
--   * Browsers talk to the database as the `anon` / `authenticated` roles and
--     are limited by Row Level Security plus column-level grants.
--   * Chip balances can only change through public.apply_chip_delta(), which
--     browsers are not allowed to call. Every change writes a ledger row.
--   * Chips are play money. Nothing here represents real currency.

create extension if not exists citext with schema extensions;

-- ---------------------------------------------------------------------------
-- profiles: one row per account. Public information only (no email).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    extensions.citext not null unique
              check (username operator(extensions.~) '^[A-Za-z0-9_]{3,20}$'),
  avatar      text not null default 'spade'
              check (avatar in ('spade','heart','diamond','club','crown','star',
                                'flame','bolt','gem','rocket','ghost','cat')),
  chips       bigint not null default 0 check (chips >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Public player profile and current virtual chip balance.';

-- ---------------------------------------------------------------------------
-- chip_transactions: append-only ledger of every balance change.
-- ---------------------------------------------------------------------------
create table public.chip_transactions (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  amount        bigint not null check (amount <> 0),
  balance_after bigint not null check (balance_after >= 0),
  kind          text not null
                check (kind in ('signup_bonus','daily_bonus','table_buy_in',
                                'table_cash_out','adjustment')),
  ref_id        uuid,
  created_at    timestamptz not null default now()
);

create index chip_transactions_user_created_idx
  on public.chip_transactions (user_id, created_at desc);

-- The welcome grant can exist at most once per account, enforced by the database.
create unique index chip_transactions_one_signup_bonus_idx
  on public.chip_transactions (user_id) where kind = 'signup_bonus';

-- ---------------------------------------------------------------------------
-- player_stats: lifetime poker statistics, written by the game server.
-- ---------------------------------------------------------------------------
create table public.player_stats (
  user_id      uuid primary key references public.profiles (id) on delete cascade,
  hands_played integer not null default 0 check (hands_played >= 0),
  hands_won    integer not null default 0 check (hands_won >= 0),
  total_won    bigint  not null default 0 check (total_won >= 0),
  biggest_pot  bigint  not null default 0 check (biggest_pot >= 0),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger player_stats_touch_updated_at
  before update on public.player_stats
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- apply_chip_delta: the ONLY way a balance changes.
-- Locks the profile row, checks the result is not negative, updates the
-- balance and writes the ledger row in one transaction.
-- ---------------------------------------------------------------------------
create function public.apply_chip_delta(
  p_user_id uuid,
  p_amount  bigint,
  p_kind    text,
  p_ref_id  uuid default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_balance bigint;
begin
  if p_amount = 0 then
    raise exception 'chip amount must not be zero';
  end if;

  select chips into v_balance
    from public.profiles
   where id = p_user_id
     for update;

  if not found then
    raise exception 'profile % not found', p_user_id;
  end if;

  v_balance := v_balance + p_amount;

  if v_balance < 0 then
    raise exception 'insufficient chips' using errcode = 'P0001';
  end if;

  update public.profiles set chips = v_balance where id = p_user_id;

  insert into public.chip_transactions (user_id, amount, balance_after, kind, ref_id)
  values (p_user_id, p_amount, v_balance, p_kind, p_ref_id);

  return v_balance;
end;
$$;

revoke all on function public.apply_chip_delta(uuid, bigint, text, uuid)
  from public, anon, authenticated;
grant execute on function public.apply_chip_delta(uuid, bigint, text, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- handle_new_user: runs inside the sign-up transaction.
-- Creates the profile and statistics row and grants 10,000 chips exactly once.
-- If the username is invalid or taken the whole sign-up is rolled back.
-- ---------------------------------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := btrim(coalesce(new.raw_user_meta_data ->> 'username', ''));
  v_avatar   text := new.raw_user_meta_data ->> 'avatar';
begin
  if v_username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'invalid_username';
  end if;

  if v_avatar is null or v_avatar not in
     ('spade','heart','diamond','club','crown','star',
      'flame','bolt','gem','rocket','ghost','cat') then
    v_avatar := 'spade';
  end if;

  insert into public.profiles (id, username, avatar)
  values (new.id, v_username, v_avatar);

  insert into public.player_stats (user_id) values (new.id);

  perform public.apply_chip_delta(new.id, 10000, 'signup_bonus');

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Privileges and Row Level Security
-- Supabase grants broad table privileges to anon/authenticated by default, so
-- remove them and grant back only what is needed.
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.chip_transactions enable row level security;
alter table public.player_stats      enable row level security;

revoke all on public.profiles, public.chip_transactions, public.player_stats
  from anon, authenticated;

-- profiles: anyone may read (needed for leaderboards and seat labels).
-- A signed-in user may change only their own avatar. Never chips or username.
grant select on public.profiles to anon, authenticated;
grant update (avatar) on public.profiles to authenticated;

create policy "Profiles are readable by everyone"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- chip_transactions: a user sees only their own history. No client writes.
grant select on public.chip_transactions to authenticated;

create policy "Users read their own chip history"
  on public.chip_transactions for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- player_stats: readable by everyone. No client writes.
grant select on public.player_stats to anon, authenticated;

create policy "Stats are readable by everyone"
  on public.player_stats for select
  to anon, authenticated
  using (true);
