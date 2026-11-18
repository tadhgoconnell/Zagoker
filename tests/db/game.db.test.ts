/**
 * Integration tests for the tables/hands migration, run against a disposable
 * local Postgres. They drive the real poker engine through the database
 * functions exactly as the game server does.
 *
 *   TEST_DATABASE_URL=postgres://postgres@localhost:5432/postgres npm run test:db
 *
 * A database named zag_test is dropped and recreated on every run.
 */
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  applyAction,
  getLegalActions,
  startHand,
  toPlayerView,
  type HandState,
  type PlayerAction,
} from "@/lib/poker";
import { seededRandomInt } from "@/lib/poker/__tests__/helpers";

const ADMIN_URL = process.env.TEST_DATABASE_URL;
const KEY = "test-game-server-key";
const root = path.resolve(import.meta.dirname, "../..");

let pool: pg.Pool;
const users: Record<string, string> = {};

/** Runs statements as a signed-in player, the way the Supabase API would. */
async function asUser<T>(name: string | null, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query(`set local role ${name ? "authenticated" : "anon"}`);
    await c.query("select set_config('request.jwt.claim.sub', $1, true)", [name ? users[name] : ""]);
    const out = await fn(c);
    await c.query("commit");
    return out;
  } catch (e) {
    await c.query("rollback");
    throw e;
  } finally {
    c.release();
  }
}

const rpc = (name: string | null, sql: string, params: unknown[] = []) =>
  asUser(name, async (c) => (await c.query(sql, params)).rows);

/** The game server: an anonymous API caller that knows the server key. */
const server = (sql: string, params: unknown[] = []) => rpc(null, sql, params);

async function one<T = unknown>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await pool.query(sql, params);
  return r.rows[0] ? (Object.values(r.rows[0])[0] as T) : (undefined as T);
}

/** Every chip in existence: balances plus chips sitting at tables. */
const totalChips = async () =>
  Number(await one("select (select coalesce(sum(chips),0) from profiles) + (select coalesce(sum(stack),0) from table_seats)"));

const chipsOf = async (name: string) => Number(await one("select chips from profiles where id=$1", [users[name]]));
const stackOf = async (name: string) => {
  const v = await one("select stack from table_seats where user_id=$1", [users[name]]);
  return v === undefined ? null : Number(v);
};

async function createTable(owner: string, opts: Partial<{ name: string; max: number; sb: number; bb: number; buyIn: number; priv: boolean }> = {}) {
  const [t] = await rpc(owner, "select * from create_table($1,$2,$3,$4,$5,$6)", [
    opts.name ?? "Test table", opts.max ?? 6, opts.sb ?? 50, opts.bb ?? 100, opts.buyIn ?? 2000, opts.priv ?? false,
  ]);
  return t as { id: string; room_code: string; hand_number: number };
}

const join = (name: string, tableId: string, seat: number | null = null, code: string | null = null) =>
  rpc(name, "select join_table($1,$2,$3) as seat", [tableId, seat, code]).then((r) => r[0].seat as number);

async function load(tableId: string) {
  const [r] = await server("select game_load($1,$2) as data", [KEY, tableId]);
  return r.data as {
    table: { hand_number: number; dealer_seat: number | null; small_blind: string; big_blind: string };
    seats: { seat_no: number; user_id: string; stack: number; status: string }[];
    hand: { id: string; version: number; state: HandState } | null;
  };
}

/** Deals a hand the way the game server does and stores it. */
async function start(tableId: string, seed = 1) {
  const data = await load(tableId);
  const players = data.seats.filter((s) => s.status === "active" && s.stack > 0)
    .map((s) => ({ seat: s.seat_no, id: s.user_id, stack: Number(s.stack) }));
  const state = startHand({
    smallBlind: Number(data.table.small_blind),
    bigBlind: Number(data.table.big_blind),
    dealerSeat: players[0].seat,
    players,
    randomInt: seededRandomInt(seed),
  });
  const [r] = await server("select game_start_hand($1,$2,$3,$4,$5) as id", [
    KEY, tableId, data.table.hand_number, JSON.stringify(state), JSON.stringify(toPlayerView(state, null)),
  ]);
  return { handId: r.id as string, state };
}

async function commit(handId: string, before: HandState, after: HandState) {
  return server("select game_commit($1,$2,$3,$4,$5,$6) as v", [
    KEY, handId, before.version, JSON.stringify(after), JSON.stringify(toPlayerView(after, null)),
    JSON.stringify(after.actions.slice(before.actions.length)),
  ]);
}

async function act(handId: string, state: HandState, action: PlayerAction) {
  const next = applyAction(state, state.toActSeat!, action);
  await commit(handId, state, next);
  return next;
}

/** Everyone checks or calls until the hand ends. */
async function playOut(handId: string, state: HandState) {
  let s = state;
  while (!s.result) {
    s = await act(handId, s, getLegalActions(s, s.toActSeat!).canCheck ? { type: "check" } : { type: "call" });
  }
  return s;
}

describe.skipIf(!ADMIN_URL)("tables, hands and chip settlement (database)", () => {
  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query("drop database if exists zag_test with (force)");
    await admin.query("create database zag_test");
    await admin.end();

    const url = new URL(ADMIN_URL!);
    url.pathname = "/zag_test";
    // Supabase puts the extensions schema on every role's search path.
    pool = new pg.Pool({ connectionString: url.toString(), max: 8, options: "-c search_path=public,extensions" });
    pool.on("connect", (c) => void c.query("set search_path = public, extensions"));

    const run = (file: string) => pool.query(fs.readFileSync(path.join(root, "supabase", file), "utf8"));
    await run("tests/00_supabase_stub.sql");
    for (const f of fs.readdirSync(path.join(root, "supabase/migrations")).sort()) await run(`migrations/${f}`);

    await pool.query("insert into private.server_keys (key_hash, label) values (sha256(convert_to($1,'UTF8')), 'test')", [KEY]);
    for (const name of ["alice", "bob", "carol", "dave"]) {
      users[name] = await one("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
        [`${name}@test.dev`, JSON.stringify({ username: name })]);
    }
  }, 60_000);

  afterAll(async () => { await pool?.end(); });

  // Each test leaves the tables empty again so they do not affect each other.
  async function reset() {
    await pool.query("delete from poker_tables");
    await pool.query("delete from chip_transactions where kind <> 'signup_bonus'");
    await pool.query("update profiles set chips = 10000");
    await pool.query("update player_stats set hands_played=0, hands_won=0, total_won=0, biggest_pot=0");
  }

  describe("creating tables", () => {
    it("creates a table with an 8-character room code", async () => {
      await reset();
      const t = await createTable("alice");
      expect(t.room_code).toMatch(/^[A-HJ-KMNP-Z2-9]{8}$/);
      expect(await one("select count(*)::int from table_state where table_id=$1", [t.id])).toBe(1);
    });

    it("rejects invalid settings", async () => {
      await reset();
      await expect(createTable("alice", { name: "ab" })).rejects.toThrow();
      await expect(createTable("alice", { max: 1 })).rejects.toThrow();
      await expect(createTable("alice", { max: 10 })).rejects.toThrow();
      await expect(createTable("alice", { sb: 0 })).rejects.toThrow();
      await expect(createTable("alice", { sb: 200, bb: 100 })).rejects.toThrow();
      await expect(createTable("alice", { buyIn: 500 })).rejects.toThrow(); // under 10 big blinds
      await expect(createTable("alice", { buyIn: 200_000 })).rejects.toThrow(); // over 1000 big blinds
      await expect(rpc(null, "select * from create_table('Nope',6,50,100,2000,false)")).rejects.toThrow();
    });

    it("limits a player to three open tables", async () => {
      await reset();
      for (let i = 0; i < 3; i++) await createTable("alice", { name: `Table ${i}` });
      await expect(createTable("alice")).rejects.toThrow(/too_many_tables/);
    });

    it("generates room codes that do not repeat", async () => {
      const codes = (await pool.query("select private.generate_room_code() c from generate_series(1,3000)")).rows.map((r) => r.c);
      expect(new Set(codes).size).toBe(3000);
      expect(codes.every((c: string) => /^[A-HJ-KMNP-Z2-9]{8}$/.test(c))).toBe(true);
    });
  });

  describe("joining and leaving", () => {
    it("moves the buy-in from the balance to the seat and records it", async () => {
      await reset();
      const t = await createTable("alice");
      expect(await join("alice", t.id)).toBe(0);
      expect(await join("bob", t.id)).toBe(1);
      expect(await chipsOf("alice")).toBe(8000);
      expect(await stackOf("alice")).toBe(2000);
      const tx = (await pool.query("select amount, balance_after, kind, ref_id from chip_transactions where user_id=$1 and kind='table_buy_in'", [users.alice])).rows;
      expect(tx).toEqual([{ amount: "-2000", balance_after: "8000", kind: "table_buy_in", ref_id: t.id }]);
      expect(await totalChips()).toBe(40000);
    });

    it("refuses a second seat, a taken seat, an invalid seat and a full table", async () => {
      await reset();
      const t = await createTable("alice", { max: 2 });
      await join("alice", t.id, 1);
      await expect(join("alice", t.id)).rejects.toThrow(/already_seated/);
      await expect(join("bob", t.id, 1)).rejects.toThrow(/seat_taken/);
      await expect(join("bob", t.id, 2)).rejects.toThrow(/invalid_seat/);
      await join("bob", t.id);
      await expect(join("carol", t.id)).rejects.toThrow(/table_full/);
      expect(await chipsOf("carol")).toBe(10000);
    });

    it("refuses a player who cannot afford the buy-in and takes nothing", async () => {
      await reset();
      const t = await createTable("alice", { sb: 500, bb: 1000, buyIn: 10000 });
      await pool.query("update profiles set chips = 9999 where id=$1", [users.bob]);
      await expect(join("bob", t.id)).rejects.toThrow(/insufficient chips/);
      expect(await chipsOf("bob")).toBe(9999);
      expect(await stackOf("bob")).toBeNull();
    });

    it("two players racing for the same seat: exactly one gets it", async () => {
      await reset();
      const t = await createTable("alice");
      const results = await Promise.allSettled([join("bob", t.id, 3), join("carol", t.id, 3), join("dave", t.id, 3)]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await one("select count(*)::int from table_seats where table_id=$1", [t.id])).toBe(1);
      expect(await totalChips()).toBe(40000);
    });

    it("leaving between hands cashes out immediately", async () => {
      await reset();
      const t = await createTable("alice");
      await join("alice", t.id);
      expect((await rpc("alice", "select leave_table($1) r", [t.id]))[0].r).toBe("left");
      expect(await chipsOf("alice")).toBe(10000);
      expect(await stackOf("alice")).toBeNull();
      await expect(rpc("alice", "select leave_table($1)", [t.id])).rejects.toThrow(/not_seated/);
    });
  });

  describe("private tables", () => {
    it("are invisible without the room code and joinable with it", async () => {
      await reset();
      const t = await createTable("alice", { priv: true });
      await join("alice", t.id);
      expect(await rpc("bob", "select id from poker_tables")).toEqual([]);
      expect(await rpc("bob", "select * from table_seats")).toEqual([]);
      expect(await rpc("bob", "select * from table_state")).toEqual([]);
      await expect(join("bob", t.id)).rejects.toThrow(/invalid_room_code/);
      await expect(join("bob", t.id, null, "WRONGCOD")).rejects.toThrow(/invalid_room_code/);
      expect(await rpc("bob", "select id from get_table_by_code($1)", ["nope1234"])).toEqual([]);
      expect(await rpc("bob", "select id from get_table_by_code($1)", [t.room_code.toLowerCase()])).toEqual([{ id: t.id }]);
      await join("bob", t.id, null, ` ${t.room_code.toLowerCase()} `);
      expect(await rpc("bob", "select id from poker_tables")).toEqual([{ id: t.id }]);
      expect(await rpc("carol", "select id from poker_tables")).toEqual([]);
    });

    it("public tables are listed for signed-in users only", async () => {
      await reset();
      const t = await createTable("alice");
      expect(await rpc("bob", "select id from poker_tables")).toEqual([{ id: t.id }]);
      await expect(rpc(null, "select id from poker_tables")).rejects.toThrow(/permission denied/);
    });
  });

  describe("playing a hand", () => {
    it("settles stacks, statistics and history when the hand ends", async () => {
      await reset();
      const t = await createTable("alice");
      for (const n of ["alice", "bob", "carol"]) await join(n, t.id);
      const { handId, state } = await start(t.id, 7);

      // Mid-hand: balances and seat stacks are untouched; bets live in the hand.
      let s = await act(handId, state, { type: "raise", amount: 300 });
      expect(await stackOf("alice")).toBe(2000);
      expect(await totalChips()).toBe(40000);

      s = await playOut(handId, s);
      const seats = (await pool.query("select seat_no, stack::int from table_seats where table_id=$1 order by seat_no", [t.id])).rows;
      expect(seats).toEqual(s.players.map((p) => ({ seat_no: p.seat, stack: p.stack })));
      expect(seats.reduce((a, b) => a + b.stack, 0)).toBe(6000);
      expect(await totalChips()).toBe(40000);

      const stats = (await pool.query("select hands_played, hands_won, total_won::int, biggest_pot::int from player_stats s join profiles p on p.id = s.user_id where username in ('alice','bob','carol') order by username")).rows;
      expect(stats.every((r) => r.hands_played === 1)).toBe(true);
      const winners = Object.keys(s.result!.winnings).length;
      expect(stats.filter((r) => r.hands_won === 1)).toHaveLength(winners);
      expect(Math.max(...stats.map((r) => r.biggest_pot))).toBe(Math.max(...Object.values(s.result!.winnings)));

      const history = (await pool.query("select hand_number, board, result from hand_history where hand_id=$1", [handId])).rows[0];
      expect(history.hand_number).toBe(1);
      expect(history.board).toEqual(s.board);
      expect(history.result.endedBy).toBe("showdown");
      expect(await one("select status from private.hands where id=$1", [handId])).toBe("complete");
      const logged = (await pool.query("select action from hand_actions where hand_id=$1 order by seq", [handId])).rows.map((r) => r.action);
      expect(logged).toEqual(s.actions.map((a) => a.type));
    });

    it("shows each player only their own hole cards", async () => {
      await reset();
      const t = await createTable("alice");
      for (const n of ["alice", "bob"]) await join(n, t.id);
      const { state } = await start(t.id, 3);
      const cardsOf = (seat: number) => state.players.find((p) => p.seat === seat)!.holeCards;

      expect((await rpc("alice", "select get_my_hole_cards($1) c", [t.id]))[0].c).toEqual(cardsOf(0));
      expect((await rpc("bob", "select get_my_hole_cards($1) c", [t.id]))[0].c).toEqual(cardsOf(1));
      expect((await rpc("carol", "select get_my_hole_cards($1) c", [t.id]))[0].c).toBeNull();

      const publicView = JSON.stringify((await rpc("bob", "select view from table_state where table_id=$1", [t.id]))[0].view);
      for (const card of [...cardsOf(0), ...cardsOf(1), ...state.deck]) expect(publicView).not.toContain(`"${card}"`);
    });

    it("players cannot read the secret hand state by any route", async () => {
      await expect(rpc("alice", "select * from private.hands")).rejects.toThrow(/permission denied/);
      await expect(rpc("alice", "select * from private.hand_cards")).rejects.toThrow(/permission denied/);
      await expect(rpc("alice", "select * from private.server_keys")).rejects.toThrow(/permission denied/);
      await expect(rpc("alice", "select private.abort_hand(gen_random_uuid())")).rejects.toThrow(/permission denied/);
      await expect(rpc("alice", "select abort_stale_hands()")).rejects.toThrow(/permission denied/);
    });

    it("players cannot write to tables, seats or state directly", async () => {
      await reset();
      const t = await createTable("alice");
      await join("alice", t.id);
      await expect(rpc("alice", "update table_seats set stack = 999999")).rejects.toThrow(/permission denied/);
      await expect(rpc("alice", "update poker_tables set buy_in = 1")).rejects.toThrow(/permission denied/);
      await expect(rpc("alice", "update table_state set view = '{}'")).rejects.toThrow(/permission denied/);
      await expect(rpc("alice", "insert into hand_actions (hand_id, table_id, hand_number, seq, seat_no, action, street) values (gen_random_uuid(), $1, 1, 1, 0, 'bet', 'flop')", [t.id])).rejects.toThrow(/permission denied/);
      await expect(rpc("alice", "delete from table_seats")).rejects.toThrow(/permission denied/);
    });
  });

  describe("game server key", () => {
    it("every game function refuses a wrong or missing key", async () => {
      await reset();
      const t = await createTable("alice");
      for (const n of ["alice", "bob"]) await join(n, t.id);
      const { handId, state } = await start(t.id);
      const next = applyAction(state, state.toActSeat!, { type: "call" });
      for (const who of [null, "alice"]) {
        for (const key of ["wrong", "", null]) {
          await expect(rpc(who, "select game_load($1,$2)", [key, t.id])).rejects.toThrow(/forbidden/);
          await expect(rpc(who, "select game_start_hand($1,$2,0,$3,$3)", [key, t.id, JSON.stringify(state)])).rejects.toThrow(/forbidden/);
          await expect(rpc(who, "select game_commit($1,$2,0,$3,$3,'[]')", [key, handId, JSON.stringify(next)])).rejects.toThrow(/forbidden/);
          await expect(rpc(who, "select game_abort_hand($1,$2)", [key, handId])).rejects.toThrow(/forbidden/);
        }
      }
      expect(await one("select version from private.hands where id=$1", [handId])).toBe(0);
    });

    it("stores only a hash of the key", async () => {
      const stored = (await pool.query("select encode(key_hash,'escape') h from private.server_keys")).rows[0].h;
      expect(stored).not.toContain(KEY);
    });
  });

  describe("duplicate and conflicting requests", () => {
    it("a table cannot have two hands at once", async () => {
      await reset();
      const t = await createTable("alice");
      for (const n of ["alice", "bob"]) await join(n, t.id);
      const results = await Promise.allSettled([start(t.id, 1), start(t.id, 2), start(t.id, 3)]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await one("select count(*)::int from private.hands where table_id=$1", [t.id])).toBe(1);
    });

    it("the same action sent twice is applied once", async () => {
      await reset();
      const t = await createTable("alice");
      for (const n of ["alice", "bob", "carol"]) await join(n, t.id);
      const { handId, state } = await start(t.id);
      const next = applyAction(state, state.toActSeat!, { type: "raise", amount: 400 });
      const results = await Promise.allSettled([commit(handId, state, next), commit(handId, state, next), commit(handId, state, next)]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected").every((r) => /stale_version/.test(String((r as PromiseRejectedResult).reason)))).toBe(true);
      expect(await one("select count(*)::int from hand_actions where hand_id=$1 and action='raise'", [handId])).toBe(1);
    });

    it("an action based on an out-of-date state is rejected", async () => {
      await reset();
      const t = await createTable("alice");
      for (const n of ["alice", "bob", "carol"]) await join(n, t.id);
      const { handId, state } = await start(t.id);
      const s1 = await act(handId, state, { type: "call" });
      const conflicting = applyAction(state, state.toActSeat!, { type: "fold" });
      await expect(commit(handId, state, conflicting)).rejects.toThrow(/stale_version/);
      expect(await one("select version from private.hands where id=$1", [handId])).toBe(s1.version);
    });
  });

  describe("the database double-checks the server", () => {
    it("refuses to deal with stacks that differ from the seats", async () => {
      await reset();
      const t = await createTable("alice");
      for (const n of ["alice", "bob"]) await join(n, t.id);
      const state = startHand({
        smallBlind: 50, bigBlind: 100, dealerSeat: 0, randomInt: seededRandomInt(1),
        players: [{ seat: 0, id: users.alice, stack: 2000 }, { seat: 1, id: users.bob, stack: 50_000 }],
      });
      await expect(server("select game_start_hand($1,$2,0,$3,$3)", [KEY, t.id, JSON.stringify(state)])).rejects.toThrow(/stack_mismatch/);
      const ghost = startHand({
        smallBlind: 50, bigBlind: 100, dealerSeat: 0, randomInt: seededRandomInt(1),
        players: [{ seat: 0, id: users.alice, stack: 2000 }, { seat: 1, id: users.carol, stack: 2000 }],
      });
      await expect(server("select game_start_hand($1,$2,0,$3,$3)", [KEY, t.id, JSON.stringify(ghost)])).rejects.toThrow(/seat_mismatch/);
    });

    it("refuses to settle a hand that created chips, and changes nothing", async () => {
      await reset();
      const t = await createTable("alice");
      for (const n of ["alice", "bob"]) await join(n, t.id);
      const { handId, state } = await start(t.id);
      const finished = applyAction(state, state.toActSeat!, { type: "fold" });
      const forged = structuredClone(finished);
      forged.players[0].stack += 5000;
      await expect(commit(handId, state, forged)).rejects.toThrow(/chip_conservation_violated/);
      expect(await one("select status from private.hands where id=$1", [handId])).toBe("active");
      expect(await stackOf("alice")).toBe(2000);
      await commit(handId, state, finished); // the honest result still goes through
      expect(await totalChips()).toBe(40000);
    });
  });

  describe("leaving, busting and abandoned hands", () => {
    it("a player who leaves mid-hand is cashed out with their final stack when it ends", async () => {
      await reset();
      const t = await createTable("alice");
      for (const n of ["alice", "bob", "carol"]) await join(n, t.id);
      const { handId, state } = await start(t.id, 11);
      expect((await rpc("bob", "select leave_table($1) r", [t.id]))[0].r).toBe("leaving");
      expect(await chipsOf("bob")).toBe(8000); // not paid out yet
      const s = await playOut(handId, state);
      const bobFinal = s.players.find((p) => p.id === users.bob)!.stack;
      expect(await stackOf("bob")).toBeNull();
      expect(await chipsOf("bob")).toBe(8000 + bobFinal);
      expect(await totalChips()).toBe(40000);
    });

    it("a player who loses everything is removed from the table", async () => {
      await reset();
      const t = await createTable("alice");
      for (const n of ["alice", "bob"]) await join(n, t.id);
      // Keep dealing all-in hands until someone is bust.
      for (let seed = 1; (await one<number>("select count(*)::int from table_seats where table_id=$1", [t.id])) === 2; seed++) {
        const { handId, state } = await start(t.id, seed);
        const s = await act(handId, state, { type: "allin" });
        if (!s.result) await act(handId, s, { type: "call" });
        expect(await totalChips()).toBe(40000);
      }
      const left = (await pool.query("select stack::int from table_seats where table_id=$1", [t.id])).rows;
      expect(left).toEqual([{ stack: 4000 }]);
      expect((await chipsOf("alice")) + (await chipsOf("bob"))).toBe(16000);
    });

    it("an aborted hand returns every chip to where it started", async () => {
      await reset();
      const t = await createTable("alice");
      for (const n of ["alice", "bob", "carol"]) await join(n, t.id);
      const { handId, state } = await start(t.id);
      const raised = await act(handId, state, { type: "raise", amount: 900 });
      await act(handId, raised, { type: "call" });
      await rpc("carol", "select leave_table($1)", [t.id]);

      expect((await server("select game_abort_hand($1,$2) ok", [KEY, handId]))[0].ok).toBe(true);
      expect(await one("select status from private.hands where id=$1", [handId])).toBe("aborted");
      expect(await stackOf("alice")).toBe(2000);
      expect(await stackOf("bob")).toBe(2000);
      expect(await chipsOf("carol")).toBe(10000); // she was leaving: full stack returned
      expect(await totalChips()).toBe(40000);
      expect((await pool.query("select hands_played from player_stats")).rows.every((r) => r.hands_played === 0)).toBe(true);
      // Aborting twice is harmless, and the table can deal again.
      expect((await server("select game_abort_hand($1,$2) ok", [KEY, handId]))[0].ok).toBe(false);
      await start(t.id, 2);
    });

    it("the scheduled sweep aborts only hands that have gone quiet", async () => {
      await reset();
      const t1 = await createTable("alice", { name: "Stale" });
      const t2 = await createTable("carol", { name: "Fresh" });
      await join("alice", t1.id); await join("bob", t1.id);
      await join("carol", t2.id); await join("dave", t2.id);
      const stale = await start(t1.id);
      const fresh = await start(t2.id);
      await pool.query("update private.hands set updated_at = now() - interval '11 minutes' where id=$1", [stale.handId]);
      expect(await one("select abort_stale_hands()")).toBe(1);
      expect(await one("select status from private.hands where id=$1", [stale.handId])).toBe("aborted");
      expect(await one("select status from private.hands where id=$1", [fresh.handId])).toBe("active");
      expect(await totalChips()).toBe(40000);
    });

    it("only the owner can close a table, and not during a hand", async () => {
      await reset();
      const t = await createTable("alice");
      for (const n of ["alice", "bob"]) await join(n, t.id);
      await expect(rpc("bob", "select close_table($1)", [t.id])).rejects.toThrow(/not_table_owner/);
      const { handId, state } = await start(t.id);
      await expect(rpc("alice", "select close_table($1)", [t.id])).rejects.toThrow(/hand_in_progress/);
      await playOut(handId, state);
      await rpc("alice", "select close_table($1)", [t.id]);
      expect(await one("select status from poker_tables where id=$1", [t.id])).toBe("closed");
      expect(await one("select count(*)::int from table_seats where table_id=$1", [t.id])).toBe(0);
      expect((await chipsOf("alice")) + (await chipsOf("bob"))).toBe(20000);
      await expect(join("carol", t.id)).rejects.toThrow(/table_not_found/);
    });
  });

  describe("timers, sitting out and maintenance", () => {
    it("every seat change bumps the table's change feed", async () => {
      await reset();
      const t = await createTable("alice");
      const rev = () => one<number>("select seats_rev from table_state where table_id=$1", [t.id]);
      expect(await rev()).toBe(0);
      await join("alice", t.id);
      expect(await rev()).toBe(1);
      await rpc("alice", "select leave_table($1)", [t.id]);
      expect(await rev()).toBe(2);
    });

    it("a sitting-out player keeps their seat but cannot be dealt in until they return", async () => {
      await reset();
      const t = await createTable("alice");
      for (const n of ["alice", "bob", "carol"]) await join(n, t.id);
      await expect(rpc(null, "select game_set_sitting_out('wrong',$1,$2)", [t.id, users.carol])).rejects.toThrow(/forbidden/);
      await server("select game_set_sitting_out($1,$2,$3)", [KEY, t.id, users.carol]);
      expect(await one("select status from table_seats where user_id=$1", [users.carol])).toBe("sitting_out");
      expect(await stackOf("carol")).toBe(2000);

      const dealt = await start(t.id);
      expect(dealt.state.players.map((p) => p.id).sort()).toEqual([users.alice, users.bob].sort());
      await playOut(dealt.handId, dealt.state);

      // The server cannot deal a sitting-out player in, even if it tried.
      const forced = startHand({
        smallBlind: 50, bigBlind: 100, dealerSeat: 0, randomInt: seededRandomInt(1),
        players: (await load(t.id)).seats.map((s) => ({ seat: s.seat_no, id: s.user_id, stack: Number(s.stack) })),
      });
      await expect(server("select game_start_hand($1,$2,1,$3,$3)", [KEY, t.id, JSON.stringify(forced)])).rejects.toThrow(/seat_mismatch/);

      await expect(rpc("bob", "select sit_in($1)", [t.id])).rejects.toThrow(/not_seated/); // bob is not sitting out
      await rpc("carol", "select sit_in($1)", [t.id]);
      expect((await start(t.id, 2)).state.players).toHaveLength(3);
    });

    it("the server is told the turn deadline and when the last hand ended", async () => {
      await reset();
      const t = await createTable("alice");
      for (const n of ["alice", "bob"]) await join(n, t.id);
      expect((await load(t.id) as unknown as { last_hand_ended_at: string | null }).last_hand_ended_at).toBeNull();
      const { handId, state } = await start(t.id);
      const deadline = new Date(Date.now() + 30_000).toISOString();
      const next = applyAction(state, state.toActSeat!, { type: "call" });
      await server("select game_commit($1,$2,$3,$4,$4,'[]',$5)", [KEY, handId, state.version, JSON.stringify(next), deadline]);
      const mid = await load(t.id) as unknown as { turn_deadline: string; last_hand_ended_at: string | null; now: string };
      expect(new Date(mid.turn_deadline).toISOString()).toBe(deadline);
      expect(mid.last_hand_ended_at).toBeNull();
      await playOut(handId, next);
      const after = await load(t.id) as unknown as { last_hand_ended_at: string | null; now: string };
      expect(after.last_hand_ended_at).not.toBeNull();
      expect(Math.abs(new Date(after.now).getTime() - Date.now())).toBeLessThan(60_000);
    });

    it("maintenance cancels dead hands, removes long-absent players and closes idle tables", async () => {
      await reset();
      const t = await createTable("alice", { name: "Busy" });
      const idle = await createTable("alice", { name: "Idle" });
      for (const n of ["alice", "bob", "carol"]) await join(n, t.id);
      await server("select game_set_sitting_out($1,$2,$3)", [KEY, t.id, users.carol]);
      const { handId } = await start(t.id);

      // Nothing is old enough yet.
      expect(await one("select table_maintenance()")).toEqual({ aborted_hands: 0, removed_seats: 0, closed_tables: 0 });

      await pool.query("update private.hands set updated_at = now() - interval '4 minutes' where id=$1", [handId]);
      await pool.query("update table_seats set away_since = now() - interval '16 minutes' where user_id=$1", [users.carol]);
      await pool.query("alter table poker_tables disable trigger poker_tables_touch_updated_at");
      await pool.query("update poker_tables set updated_at = now() - interval '2 hours' where id=$1", [idle.id]);
      await pool.query("alter table poker_tables enable trigger poker_tables_touch_updated_at");
      await pool.query("update table_state set updated_at = now() - interval '2 hours' where table_id=$1", [idle.id]);

      expect(await one("select table_maintenance()")).toEqual({ aborted_hands: 1, removed_seats: 1, closed_tables: 1 });
      expect(await chipsOf("carol")).toBe(10000);
      expect(await stackOf("carol")).toBeNull();
      expect(await stackOf("alice")).toBe(2000);
      expect(await one("select status from poker_tables where id=$1", [idle.id])).toBe("closed");
      expect(await one("select status from poker_tables where id=$1", [t.id])).toBe("open");
      expect(await totalChips()).toBe(40000);
      await expect(rpc("alice", "select table_maintenance()")).rejects.toThrow(/permission denied/);
    });
  });

  describe("chat, daily bonus and leaderboard", () => {
    it("seated players can chat; messages are stored exactly as written", async () => {
      await reset();
      const t = await createTable("alice", { priv: true });
      await join("alice", t.id);
      await join("bob", t.id, null, t.room_code);
      const text = "  nice hand, you lucky <b>donkey</b> 😀 '; drop table x; --  ";
      await rpc("alice", "select send_chat_message($1,$2)", [t.id, text]);
      const seen = await rpc("bob", "select username, body from chat_messages where table_id=$1", [t.id]);
      expect(seen).toEqual([{ username: "alice", body: text.trim() }]);
      // People who cannot see the table cannot read or post.
      expect(await rpc("carol", "select body from chat_messages")).toEqual([]);
      await expect(rpc("carol", "select send_chat_message($1,'hi')", [t.id])).rejects.toThrow(/not_seated/);
      await expect(rpc(null, "select send_chat_message($1,'hi')", [t.id])).rejects.toThrow(/permission denied|not_authenticated/);
      await expect(rpc("bob", "insert into chat_messages (table_id, user_id, username, body) values ($1,$2,'alice','forged')", [t.id, users.alice])).rejects.toThrow(/permission denied/);
    });

    it("rejects empty and over-long messages and limits bursts", async () => {
      await reset();
      await pool.query("delete from chat_messages");
      const t = await createTable("alice");
      await join("alice", t.id);
      await expect(rpc("alice", "select send_chat_message($1,'   ')", [t.id])).rejects.toThrow(/invalid_message/);
      await expect(rpc("alice", "select send_chat_message($1,$2)", [t.id, "x".repeat(501)])).rejects.toThrow(/invalid_message/);
      await rpc("alice", "select send_chat_message($1,$2)", [t.id, "x".repeat(500)]);
      for (let i = 0; i < 4; i++) await rpc("alice", "select send_chat_message($1,'spam')", [t.id]);
      await expect(rpc("alice", "select send_chat_message($1,'spam')", [t.id])).rejects.toThrow(/chat_rate_limited/);
    });

    it("the daily bonus can be claimed once per 24 hours, even when claimed twice at once", async () => {
      await reset();
      await pool.query("delete from chip_transactions where kind = 'daily_bonus'");
      expect((await rpc("alice", "select daily_bonus_next_at() n"))[0].n).toBeNull();
      const results = await Promise.allSettled([1, 2, 3, 4].map(() => rpc("alice", "select claim_daily_bonus() r")));
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected").every((r) => /bonus_not_ready/.test(String((r as PromiseRejectedResult).reason)))).toBe(true);
      expect(await chipsOf("alice")).toBe(11000);
      expect((await rpc("alice", "select daily_bonus_next_at() n"))[0].n).not.toBeNull();
      expect(await chipsOf("bob")).toBe(10000); // other players are unaffected

      // 23 hours later: still too early. 25 hours later: allowed again.
      await pool.query("update chip_transactions set created_at = now() - interval '23 hours' where kind='daily_bonus'");
      await expect(rpc("alice", "select claim_daily_bonus()")).rejects.toThrow(/bonus_not_ready/);
      await pool.query("update chip_transactions set created_at = now() - interval '25 hours' where kind='daily_bonus'");
      const [{ r }] = await rpc("alice", "select claim_daily_bonus() r");
      expect(r).toMatchObject({ amount: 1000, balance: 12000 });
      await expect(rpc(null, "select claim_daily_bonus()")).rejects.toThrow(/permission denied/);
      await pool.query("delete from chip_transactions where kind = 'daily_bonus'");
    });

    it("the leaderboard counts chips at tables and never exposes more than totals", async () => {
      await reset();
      const t = await createTable("alice", { priv: true });
      await join("alice", t.id); // 2,000 of alice's chips are now at a private table
      await pool.query("update profiles set chips = 15000 where id=$1", [users.bob]);
      await pool.query("update player_stats set hands_won = 9, biggest_pot = 700 where user_id=$1", [users.carol]);
      const byChips = await rpc(null, "select rank::int, username, chips::int from get_leaderboard('chips', 3)");
      expect(byChips[0]).toEqual({ rank: 1, username: "bob", chips: 15000 });
      expect(byChips).toHaveLength(3);
      expect(byChips.find((r) => r.username === "alice")?.chips ?? 10000).toBe(10000);
      expect((await rpc(null, "select username from get_leaderboard('hands_won', 1)"))[0].username).toBe("carol");
      expect((await rpc(null, "select username from get_leaderboard('biggest_pot', 1)"))[0].username).toBe("carol");
      expect(await rpc(null, "select username from get_leaderboard('chips; drop table profiles', 1000)")).toHaveLength(4);

      const [profile] = await rpc(null, "select username, chips::int, chip_rank::int, hands_won from get_player_profile('ALICE')");
      expect(profile).toEqual({ username: "alice", chips: 10000, chip_rank: 2, hands_won: 0 });
      expect(await rpc(null, "select * from get_player_profile('nobody')")).toEqual([]);
    });
  });

  describe("profile photos", () => {
    it("a player can point their photo only at a file in their own folder", async () => {
      const own = `${users.alice}/1700000000000.jpg`;
      await rpc("alice", "update profiles set avatar_path = $1 where id = $2", [own, users.alice]);
      expect(await one("select avatar_path from profiles where id=$1", [users.alice])).toBe(own);
      // Someone else's folder, a path escape, an odd file type: refused by the database.
      for (const bad of [`${users.bob}/1.jpg`, `${users.alice}/../x.jpg`, `${users.alice}/a.svg`, `x/${users.alice}/a.jpg`]) {
        await expect(rpc("alice", "update profiles set avatar_path = $1 where id = $2", [bad, users.alice])).rejects.toThrow(/check constraint/);
      }
      // Another player's profile cannot be changed at all (no row matches).
      await rpc("alice", "update profiles set avatar_path = null where id = $1", [users.bob]);
      await rpc("alice", "update profiles set avatar_path = null where id = $1", [users.alice]);
      expect(await one("select avatar_path from profiles where id=$1", [users.alice])).toBeNull();
    });

    it("rankings and public profiles include the photo", async () => {
      await pool.query("update profiles set avatar_path = $1 where id = $2", [`${users.carol}/9.jpg`, users.carol]);
      const [row] = await rpc(null, "select avatar_path from get_player_profile('carol')");
      expect(row.avatar_path).toBe(`${users.carol}/9.jpg`);
      const board = await rpc(null, "select username, avatar_path from get_leaderboard('chips', 10)");
      expect(board.find((r) => r.username === "carol")?.avatar_path).toBe(`${users.carol}/9.jpg`);
      await pool.query("update profiles set avatar_path = null");
    });
  });

  describe("many random hands", () => {
    it("300 hands with joins and leaves never create or lose a chip", async () => {
      await reset();
      const rng = seededRandomInt(99);
      const t = await createTable("alice", { sb: 25, bb: 50, buyIn: 1000 });
      const names = ["alice", "bob", "carol", "dave"];
      let hands = 0;
      for (let round = 0; hands < 300 && round < 2000; round++) {
        // Random arrivals and departures between hands.
        for (const n of names) {
          const seated = (await stackOf(n)) !== null;
          if (!seated && rng(3) === 0 && (await chipsOf(n)) >= 1000) await join(n, t.id);
          else if (seated && rng(12) === 0) await rpc(n, "select leave_table($1)", [t.id]);
        }
        if ((await one<number>("select count(*)::int from table_seats where table_id=$1", [t.id])) < 2) continue;

        const { handId, state } = await start(t.id, round + 1);
        let s = state;
        while (!s.result) {
          const legal = getLegalActions(s, s.toActSeat!);
          const options: PlayerAction[] = [legal.canCheck ? { type: "check" } : { type: "fold" }];
          if (legal.callAmount > 0) options.push({ type: "call" }, { type: "call" });
          if (legal.raise) options.push({ type: legal.raise.type, amount: legal.raise.min }, { type: "allin" });
          s = await act(handId, s, options[rng(options.length)]);
        }
        hands++;
        expect(await totalChips()).toBe(40000);
      }
      expect(hands).toBe(300);
      // The ledger adds up to every balance.
      const drift = await one<number>(`select count(*)::int from profiles p
        where chips <> (select coalesce(sum(amount),0) from chip_transactions c where c.user_id = p.id)`);
      expect(drift).toBe(0);
      expect(await one<number>("select count(*)::int from private.hands where status='active'")).toBe(0);
    }, 180_000);
  });
});
