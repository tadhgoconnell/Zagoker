-- Stage 6: table chat, daily chip bonus, leaderboard and public profiles.

-- ---------------------------------------------------------------------------
-- Table chat. Messages are stored as written (no word filtering) and are
-- visible to anyone who can see the table. Only seated players can post.
-- ---------------------------------------------------------------------------
create table public.chat_messages (
  id         bigint generated always as identity primary key,
  table_id   uuid not null references public.poker_tables (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  -- Name at the time of posting, so messages still read correctly after the
  -- author has left the table.
  username   text not null,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index chat_messages_table_idx on public.chat_messages (table_id, id desc);
create index chat_messages_user_recent_idx on public.chat_messages (user_id, created_at desc);

alter table public.chat_messages enable row level security;
revoke all on public.chat_messages from anon, authenticated;
grant select on public.chat_messages to authenticated;

create policy "Chat of visible tables is readable" on public.chat_messages
  for select to authenticated using (public.can_view_table(table_id));

-- Posts a message as the caller. Limited to 5 messages per 10 seconds.
create function public.send_chat_message(p_table_id uuid, p_body text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text;
  v_body text := btrim(coalesce(p_body, ''));
  v_id   bigint;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.table_seats where table_id = p_table_id and user_id = v_user
  ) then
    raise exception 'not_seated';
  end if;
  if char_length(v_body) = 0 or char_length(v_body) > 500 then
    raise exception 'invalid_message';
  end if;
  if (select count(*) from public.chat_messages
       where user_id = v_user and created_at > now() - interval '10 seconds') >= 5 then
    raise exception 'chat_rate_limited';
  end if;

  select username::text into v_name from public.profiles where id = v_user;

  insert into public.chat_messages (table_id, user_id, username, body)
  values (p_table_id, v_user, v_name, v_body)
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Daily bonus: 1,000 free chips, once every 24 hours per account.
-- The profile row is locked first, so two simultaneous claims are processed
-- one after the other and the second one sees the first.
-- ---------------------------------------------------------------------------
create function public.claim_daily_bonus()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_amount   constant bigint := 1000;
  c_cooldown constant interval := interval '24 hours';
  v_user    uuid := auth.uid();
  v_last    timestamptz;
  v_balance bigint;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  perform 1 from public.profiles where id = v_user for update;
  if not found then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  select max(created_at) into v_last
    from public.chip_transactions
   where user_id = v_user and kind = 'daily_bonus';

  if v_last is not null and v_last > now() - c_cooldown then
    raise exception 'bonus_not_ready';
  end if;

  v_balance := public.apply_chip_delta(v_user, c_amount, 'daily_bonus');
  return jsonb_build_object(
    'amount', c_amount,
    'balance', v_balance,
    'next_at', now() + c_cooldown
  );
end;
$$;

-- When the caller may next claim (null = right now).
create function public.daily_bonus_next_at()
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case when max(created_at) + interval '24 hours' > now()
              then max(created_at) + interval '24 hours' end
    from public.chip_transactions
   where user_id = (select auth.uid()) and kind = 'daily_bonus';
$$;

-- ---------------------------------------------------------------------------
-- Leaderboard and public profiles. A player's total includes chips sitting
-- at a table, so buying in does not drop them down the rankings. Runs with
-- definer rights so stacks at private tables are counted, but only the total
-- is returned: it never reveals which table someone is at.
-- ---------------------------------------------------------------------------
create function public.get_leaderboard(p_sort text default 'chips', p_limit integer default 50)
returns table (
  rank bigint, username text, avatar text, chips bigint,
  hands_played integer, hands_won integer, total_won bigint, biggest_pot bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with players as (
    select p.username::text as username, p.avatar,
           p.chips + coalesce((select sum(s.stack) from public.table_seats s where s.user_id = p.id), 0) as chips,
           st.hands_played, st.hands_won, st.total_won, st.biggest_pot, p.created_at
      from public.profiles p
      join public.player_stats st on st.user_id = p.id
  )
  select row_number() over (
           order by case p_sort
                      when 'hands_won' then hands_won
                      when 'biggest_pot' then biggest_pot
                      else chips
                    end desc,
                    chips desc, created_at asc) as rank,
         username, avatar, chips::bigint, hands_played, hands_won, total_won, biggest_pot
    from players
   order by 1
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

create function public.get_player_profile(p_username text)
returns table (
  username text, avatar text, chips bigint, created_at timestamptz,
  hands_played integer, hands_won integer, total_won bigint, biggest_pot bigint, chip_rank bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select p.id, p.username::text as username, p.avatar, p.created_at,
           (p.chips + coalesce((select sum(s.stack) from public.table_seats s where s.user_id = p.id), 0))::bigint as chips
      from public.profiles p
  )
  select t.username, t.avatar, t.chips, t.created_at,
         st.hands_played, st.hands_won, st.total_won, st.biggest_pot,
         (select count(*) + 1 from totals o where o.chips > t.chips)
    from totals t
    join public.player_stats st on st.user_id = t.id
   where lower(t.username) = lower(btrim(p_username));
$$;

revoke all on function
  public.send_chat_message(uuid, text),
  public.claim_daily_bonus(),
  public.daily_bonus_next_at(),
  public.get_leaderboard(text, integer),
  public.get_player_profile(text)
  from public, anon, authenticated;

grant execute on function
  public.send_chat_message(uuid, text),
  public.claim_daily_bonus(),
  public.daily_bonus_next_at()
  to authenticated;

-- Rankings and profiles are public pages.
grant execute on function
  public.get_leaderboard(text, integer),
  public.get_player_profile(text)
  to anon, authenticated;

-- Live chat delivery.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chat_messages;
  else
    raise notice 'supabase_realtime publication not found: skipping';
  end if;
end;
$$;
