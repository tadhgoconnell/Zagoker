-- Stage 8: permission tidy-up found by the security audit.
--
-- These are trigger functions. Postgres refuses to run a trigger function
-- outside a trigger, so the grants were harmless, but nothing outside the
-- database needs them, so no client role should hold them.
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function private.touch_table_state() from public, anon, authenticated;
