-- Removes the throwaway accounts created by the automated tests.
-- They all have usernames starting with "zagtest_".
--
-- Run the SELECT first and check the list. Then run the DELETE.
-- Deleting an account also deletes its profile, statistics, chip history,
-- chat messages and any tables it owns (cascade). Chips at a table owned by
-- someone else are not paid out; close such tables first if that matters.

-- 1. Preview
select p.username, u.email, u.is_anonymous, p.chips, u.created_at
  from auth.users u
  join public.profiles p on p.id = u.id
 where p.username like 'zagtest\_%' escape '\'
 order by u.created_at;

-- 2. Delete (uncomment to run)
-- delete from auth.users
--  where id in (select id from public.profiles where username like 'zagtest\_%' escape '\');
