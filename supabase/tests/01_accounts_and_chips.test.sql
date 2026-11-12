-- Security and behaviour tests for the accounts/chips migration.
-- Each check raises an exception on failure, so psql exits non-zero.
\set ON_ERROR_STOP on
-- Supabase puts the extensions schema on the search path for every role.
set search_path = public, extensions;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test.dev', '{"username":"Alice","avatar":"crown"}'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test.dev', '{"username":"bob_99"}');

create function pg_temp.expect_fail(p_sql text, p_label text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok   - % (rejected: %)', p_label, sqlerrm;
    return;
  end;
  raise exception 'FAIL - % was allowed', p_label;
end $$;

create function pg_temp.expect(p_ok boolean, p_label text) returns void
language plpgsql as $$
begin
  if p_ok is not true then raise exception 'FAIL - %', p_label; end if;
  raise notice 'ok   - %', p_label;
end $$;

-- Sign-up side effects -------------------------------------------------------
select pg_temp.expect((select chips = 10000 and avatar = 'crown' from public.profiles where username = 'alice'),
  'new user gets profile, chosen avatar and 10,000 chips (username is case-insensitive)');
select pg_temp.expect((select count(*) = 1 and min(amount) = 10000 and min(balance_after) = 10000
  from public.chip_transactions where user_id = '00000000-0000-0000-0000-00000000000a' and kind = 'signup_bonus'),
  'signup bonus is recorded once in the ledger');
select pg_temp.expect((select count(*) = 2 from public.player_stats), 'stats row created per user');
select pg_temp.expect((select avatar = 'spade' from public.profiles where username = 'bob_99'), 'missing avatar falls back to default');

select pg_temp.expect_fail($$insert into auth.users (email, raw_user_meta_data) values ('c@test.dev', '{"username":"ALICE"}')$$,
  'duplicate username (different case)');
select pg_temp.expect((select count(*) = 0 from auth.users where email = 'c@test.dev'), 'failed sign-up leaves no account behind');
select pg_temp.expect_fail($$insert into auth.users (email, raw_user_meta_data) values ('d@test.dev', '{"username":"x"}')$$, 'username too short');
select pg_temp.expect_fail($$insert into auth.users (email, raw_user_meta_data) values ('d@test.dev', '{"username":"bad name!"}')$$, 'username with illegal characters');
select pg_temp.expect_fail($$insert into auth.users (email, raw_user_meta_data) values ('d@test.dev', '{}')$$, 'missing username');
select pg_temp.expect_fail($$select public.apply_chip_delta('00000000-0000-0000-0000-00000000000a', 10000, 'signup_bonus')$$, 'second signup bonus');

-- Ledger function -------------------------------------------------------------
select pg_temp.expect(public.apply_chip_delta('00000000-0000-0000-0000-00000000000a', -2500, 'table_buy_in') = 7500, 'debit updates balance');
select pg_temp.expect_fail($$select public.apply_chip_delta('00000000-0000-0000-0000-00000000000a', -7501, 'table_buy_in')$$, 'overdraft');
select pg_temp.expect((select chips = 7500 from public.profiles where username = 'alice'), 'balance unchanged after rejected overdraft');
select pg_temp.expect((select sum(amount) = 7500 from public.chip_transactions where user_id = '00000000-0000-0000-0000-00000000000a'),
  'ledger sums to the balance');

-- Signed-in user (Alice) --------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

select pg_temp.expect((select count(*) = 2 from public.profiles), 'authenticated can read all profiles');
select pg_temp.expect((select count(*) = 2 and bool_and(user_id = '00000000-0000-0000-0000-00000000000a') from public.chip_transactions),
  'authenticated sees only own chip history');
update public.profiles set avatar = 'gem' where id = '00000000-0000-0000-0000-00000000000a';
select pg_temp.expect((select avatar = 'gem' from public.profiles where username = 'alice'), 'user can change own avatar');
update public.profiles set avatar = 'cat' where id = '00000000-0000-0000-0000-00000000000b';
select pg_temp.expect((select avatar = 'spade' from public.profiles where username = 'bob_99'), 'user cannot change another user''s avatar');
select pg_temp.expect_fail($$update public.profiles set chips = 999999 where id = '00000000-0000-0000-0000-00000000000a'$$, 'user editing own chips');
select pg_temp.expect_fail($$update public.profiles set username = 'hacker' where id = '00000000-0000-0000-0000-00000000000a'$$, 'user editing username');
select pg_temp.expect_fail($$update public.profiles set avatar = 'not-an-avatar' where id = '00000000-0000-0000-0000-00000000000a'$$, 'invalid avatar value');
select pg_temp.expect_fail($$insert into public.profiles (id, username) values (gen_random_uuid(), 'ghost_row')$$, 'user inserting a profile');
select pg_temp.expect_fail($$delete from public.profiles$$, 'user deleting profiles');
select pg_temp.expect_fail($$insert into public.chip_transactions (user_id, amount, balance_after, kind) values ('00000000-0000-0000-0000-00000000000a', 5000, 99999, 'adjustment')$$, 'user writing to the ledger');
select pg_temp.expect_fail($$select public.apply_chip_delta('00000000-0000-0000-0000-00000000000a', 5000, 'adjustment')$$, 'user calling apply_chip_delta');
select pg_temp.expect_fail($$update public.player_stats set hands_won = 1000$$, 'user editing stats');

-- Anonymous visitor -----------------------------------------------------------
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect((select count(*) = 2 from public.profiles), 'anon can read profiles (leaderboard)');
select pg_temp.expect_fail($$select * from public.chip_transactions$$, 'anon reading chip history');
select pg_temp.expect_fail($$update public.profiles set avatar = 'cat'$$, 'anon updating profiles');
select pg_temp.expect_fail($$select public.apply_chip_delta('00000000-0000-0000-0000-00000000000a', 5000, 'adjustment')$$, 'anon calling apply_chip_delta');

reset role;
select pg_temp.expect((select chips = 7500 from public.profiles where username = 'alice'), 'balance intact after all attacks');
\echo ALL DATABASE TESTS PASSED
