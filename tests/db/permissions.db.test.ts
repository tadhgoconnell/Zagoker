/**
 * Permission audit. Applies every migration to a fresh database and compares
 * what anonymous visitors and signed-in players can do against an explicit
 * allow-list. A migration that grants anything new, or creates a table
 * without Row Level Security, makes this test fail until the list is
 * deliberately updated.
 *
 *   TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ADMIN_URL = process.env.TEST_DATABASE_URL;
const root = path.resolve(import.meta.dirname, "../..");
let db: pg.Client;

const rows = async (sql: string) => (await db.query(sql)).rows.map((r) => Object.values(r).join(" "));

describe.skipIf(!ADMIN_URL)("database permission audit", () => {
  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query("drop database if exists zag_audit with (force)");
    await admin.query("create database zag_audit");
    await admin.end();
    const url = new URL(ADMIN_URL!);
    url.pathname = "/zag_audit";
    db = new pg.Client({ connectionString: url.toString(), options: "-c search_path=public,extensions" });
    await db.connect();
    await db.query(fs.readFileSync(path.join(root, "supabase/tests/00_supabase_stub.sql"), "utf8"));
    for (const f of fs.readdirSync(path.join(root, "supabase/migrations")).sort()) {
      await db.query(fs.readFileSync(path.join(root, "supabase/migrations", f), "utf8"));
    }
  }, 60_000);

  afterAll(async () => {
    await db?.end();
  });

  it("every table has Row Level Security enabled", async () => {
    expect(
      await rows(`select n.nspname || '.' || c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                   where c.relkind = 'r' and n.nspname in ('public', 'private') and not c.relrowsecurity`),
    ).toEqual([]);
  });

  it("clients can only read tables, and write nothing but their own avatar", async () => {
    expect(
      await rows(`select grantee, table_schema || '.' || table_name, string_agg(privilege_type, ',' order by privilege_type)
                    from information_schema.role_table_grants where grantee in ('anon', 'authenticated')
                   group by 1, 2 order by 1, 2`),
    ).toEqual([
      // Public pages: leaderboard and profiles.
      "anon public.player_stats SELECT",
      "anon public.profiles SELECT",
      // Signed-in players; Row Level Security narrows each of these further.
      "authenticated public.chat_messages SELECT",
      "authenticated public.chip_transactions SELECT",
      "authenticated public.hand_actions SELECT",
      "authenticated public.hand_history SELECT",
      "authenticated public.player_stats SELECT",
      "authenticated public.poker_tables SELECT",
      "authenticated public.profiles SELECT",
      "authenticated public.table_seats SELECT",
      "authenticated public.table_state SELECT",
    ]);
    expect(
      await rows(`select grantee, table_name, column_name, privilege_type from information_schema.column_privileges
                   where grantee in ('anon', 'authenticated') and privilege_type <> 'SELECT' order by 1, 2, 3`),
    ).toEqual(["authenticated profiles avatar UPDATE", "authenticated profiles avatar_path UPDATE"]);
  });

  it("clients can call exactly the intended functions", async () => {
    expect(
      await rows(`select r.rolname, n.nspname || '.' || p.proname from pg_proc p
                    join pg_namespace n on n.oid = p.pronamespace
                    cross join (values ('anon'), ('authenticated')) r(rolname)
                   where n.nspname in ('public', 'private') and has_function_privilege(r.rolname, p.oid, 'execute')
                   order by 1, 2`),
    ).toEqual([
      // Game server functions: useless without the game server key.
      "anon public.casino_load",
      "anon public.casino_settle",
      "anon public.casino_start",
      "anon public.casino_update",
      "anon public.game_abort_hand",
      "anon public.game_commit",
      "anon public.game_load",
      "anon public.game_set_sitting_out",
      "anon public.game_start_hand",
      // Public pages.
      "anon public.get_leaderboard",
      "anon public.get_player_profile",
      // Player functions: each acts only on the caller.
      "authenticated public.can_view_table",
      "authenticated public.casino_load",
      "authenticated public.casino_settle",
      "authenticated public.casino_start",
      "authenticated public.casino_update",
      "authenticated public.claim_daily_bonus",
      "authenticated public.close_table",
      "authenticated public.create_table",
      "authenticated public.daily_bonus_next_at",
      "authenticated public.game_abort_hand",
      "authenticated public.game_commit",
      "authenticated public.game_load",
      "authenticated public.game_set_sitting_out",
      "authenticated public.game_start_hand",
      "authenticated public.get_leaderboard",
      "authenticated public.get_my_hole_cards",
      "authenticated public.get_player_profile",
      "authenticated public.get_table_by_code",
      "authenticated public.join_table",
      "authenticated public.leave_table",
      "authenticated public.mark_table_active",
      "authenticated public.send_chat_message",
      "authenticated public.sit_in",
    ]);
  });

  it("the private schema (deck, hole cards, server keys) is unreachable", async () => {
    expect(
      await rows(`select r, has_schema_privilege(r, 'private', 'usage') from unnest(array['anon', 'authenticated']) r`),
    ).toEqual(["anon false", "authenticated false"]);
  });

  it("every privileged function pins its search path", async () => {
    expect(
      await rows(`select n.nspname || '.' || p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                   where n.nspname in ('public', 'private') and p.prosecdef
                     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`),
    ).toEqual([]);
  });
});
