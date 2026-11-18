-- Profile photos: players can use a picture from their camera roll or camera.
--
-- Photos live in a public Storage bucket, one folder per player, named by
-- their user id. A player can upload to and delete from their own folder
-- only. The profile stores just the file's path inside the bucket, and the
-- database checks that the path is inside the player's own folder.

alter table public.profiles add column avatar_path text
  check (avatar_path is null or avatar_path ~ ('^' || id::text || '/[A-Za-z0-9_-]{1,40}\.(jpg|jpeg|png|webp)$'));

-- The player may set or clear their own photo (Row Level Security already
-- limits updates to their own row).
grant update (avatar_path) on public.profiles to authenticated;

-- Rankings and public profiles now include the photo.
drop function public.get_leaderboard(text, integer);
create function public.get_leaderboard(p_sort text default 'chips', p_limit integer default 50)
returns table (
  rank bigint, username text, avatar text, avatar_path text, chips bigint,
  hands_played integer, hands_won integer, total_won bigint, biggest_pot bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with players as (
    select p.username::text as username, p.avatar, p.avatar_path,
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
         username, avatar, avatar_path, chips::bigint, hands_played, hands_won, total_won, biggest_pot
    from players
   order by 1
   limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

drop function public.get_player_profile(text);
create function public.get_player_profile(p_username text)
returns table (
  username text, avatar text, avatar_path text, chips bigint, created_at timestamptz,
  hands_played integer, hands_won integer, total_won bigint, biggest_pot bigint, chip_rank bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with totals as (
    select p.id, p.username::text as username, p.avatar, p.avatar_path, p.created_at,
           (p.chips + coalesce((select sum(s.stack) from public.table_seats s where s.user_id = p.id), 0))::bigint as chips
      from public.profiles p
  )
  select t.username, t.avatar, t.avatar_path, t.chips, t.created_at,
         st.hands_played, st.hands_won, st.total_won, st.biggest_pot,
         (select count(*) + 1 from totals o where o.chips > t.chips)
    from totals t
    join public.player_stats st on st.user_id = t.id
   where lower(t.username) = lower(btrim(p_username));
$$;

revoke all on function public.get_leaderboard(text, integer), public.get_player_profile(text) from public, anon, authenticated;
grant execute on function public.get_leaderboard(text, integer), public.get_player_profile(text) to anon, authenticated;

-- Storage: a public bucket for small images, and rules limiting each player
-- to their own folder. Skipped where Supabase Storage is not installed
-- (the local test database).
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not found: skipping bucket setup';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 524288, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update
    set public = true, file_size_limit = 524288, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

  drop policy if exists "Players manage their own photo: insert" on storage.objects;
  drop policy if exists "Players manage their own photo: select" on storage.objects;
  drop policy if exists "Players manage their own photo: delete" on storage.objects;

  create policy "Players manage their own photo: insert" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
  create policy "Players manage their own photo: select" on storage.objects
    for select to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
  create policy "Players manage their own photo: delete" on storage.objects
    for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
end;
$$;
