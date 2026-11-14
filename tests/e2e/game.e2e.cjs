/**
 * End-to-end test of tables, betting and chip settlement against a running
 * site and a real Supabase project. Three independent browser sessions play
 * real hands through the HTTP API. Creates throwaway accounts named zagtest_*.
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/game.e2e.cjs
 */
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const env = Object.fromEntries(
  fs.readFileSync(path.join(__dirname, "../../.env.local"), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

let failed = 0;
const check = (ok, label, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}${extra !== "" ? ` (${extra})` : ""}`);
};
const id = Math.random().toString(36).slice(2, 8);
const BUY_IN = 2000;

(async () => {
  const browser = await chromium.launch();
  const players = [];
  for (const tag of ["a", "b", "c"]) {
    const u = { username: `zagtest_${id}${tag}`, email: `zagtest_${id}${tag}@example.com`, password: `pw-${id}-${tag}-Zz!` };
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/register`);
    await page.fill("[name=username]", u.username);
    await page.fill("[name=email]", u.email);
    await page.fill("[name=password]", u.password);
    await page.click("main button[type=submit]");
    await page.waitForURL("**/profile?welcome=1", { timeout: 30000 });
    players.push({ ...u, ctx, page });
  }
  const [A, B, C] = players;
  check(true, "three accounts registered in three separate browser sessions");

  const call = async (p, method, url, data, headers) => {
    const res = await p.ctx.request.fetch(`${BASE}${url}`, { method, data, headers, failOnStatusCode: false });
    let json = null;
    try { json = await res.json(); } catch {}
    return { status: res.status(), json, code: json?.error?.code };
  };
  const post = (p, url, data = {}) => call(p, "POST", url, data);
  const get = (p, url) => call(p, "GET", url);
  const chipsOf = async (p) => Number((await sb.from("profiles").select("chips").eq("username", p.username).single()).data.chips);
  const totalBalance = async () => (await Promise.all(players.map(chipsOf))).reduce((x, y) => x + y, 0);

  // --- Access control ---------------------------------------------------------
  const anon = await browser.newContext();
  const anonRes = await anon.request.post(`${BASE}/api/tables`, { data: {}, failOnStatusCode: false });
  check(anonRes.status() === 401, "API refuses requests that are not logged in", anonRes.status());
  const evil = await call(A, "POST", "/api/tables", { name: "x" }, { origin: "https://evil.example" });
  check(evil.status === 403, "API refuses cross-site requests", evil.status);

  // --- Creating a table -------------------------------------------------------
  const settings = { name: `E2E ${id}`, maxPlayers: 3, smallBlind: 50, bigBlind: 100, buyIn: BUY_IN, isPrivate: true };
  check((await post(A, "/api/tables", { ...settings, buyIn: 50 })).status === 400, "invalid table settings are rejected");
  check((await post(A, "/api/tables", { ...settings, maxPlayers: 12 })).status === 400, "more than 9 seats is rejected");
  const created = await post(A, "/api/tables", settings);
  check(created.status === 200 && /^[A-Z2-9]{8}$/.test(created.json?.table?.room_code ?? ""), "host creates a private table with a room code", created.code ?? created.json?.table?.room_code);
  const T = created.json.table;
  const url = `/api/tables/${T.id}`;

  // --- Private room access ----------------------------------------------------
  check((await get(B, url)).status === 404, "a private table is invisible to non-members");
  check((await post(B, `${url}/join`, {})).code === "invalid_room_code", "joining without the room code is refused");
  check((await post(B, `${url}/join`, { roomCode: "AAAAAAAA" })).code === "invalid_room_code", "joining with a wrong room code is refused");
  check((await post(A, `${url}/join`, { seat: 0 })).json?.seat === 0, "host sits down");
  check((await post(B, `${url}/join`, { roomCode: T.room_code.toLowerCase() })).json?.seat === 1, "guest joins with the room code");
  check((await post(B, `${url}/join`, { roomCode: T.room_code })).code === "already_seated", "cannot sit down twice");
  check((await post(C, `${url}/join`, { roomCode: T.room_code, seat: 1 })).code === "seat_taken", "cannot take an occupied seat");
  check((await post(C, `${url}/join`, { roomCode: T.room_code })).json?.seat === 2, "third player joins");
  check((await chipsOf(A)) === 10000 - BUY_IN && (await chipsOf(C)) === 10000 - BUY_IN, "buy-in is deducted from each balance");
  const snap0 = await get(B, url);
  check(snap0.status === 200 && snap0.json.seats.length === 3 && snap0.json.mySeat === 1 && snap0.json.hand === null, "members see the table, seats and their own seat");
  check(snap0.json.seats[0].profiles.username === A.username, "seats include usernames and avatars");

  // --- Starting a hand ----------------------------------------------------------
  const outsider = await browser.newContext();
  check((await post(A, `${url}/action`, { version: 0, action: { type: "fold" } })).code === "no_hand", "cannot act when no hand is running");
  check((await post(B, `${url}/start`)).code === "host_starts", "only the host can start the first hand at a private table");
  const starts = await Promise.all([post(A, `${url}/start`), post(A, `${url}/start`), post(A, `${url}/start`)]);
  check(starts.filter((r) => r.status === 200).length === 1, "three simultaneous 'deal' requests start exactly one hand", starts.map((r) => r.status).join(","));

  const view = async (p) => (await get(p, url)).json;
  const views = await Promise.all(players.map(view));
  check(views.every((v, i) => v.hand.players.find((x) => x.seat === i).holeCards?.length === 2), "each player receives their own two hole cards");
  check(views.every((v, i) => v.hand.players.filter((x) => x.seat !== i).every((x) => x.holeCards === null)), "nobody receives anyone else's hole cards");
  const allCards = views.map((v, i) => v.hand.players.find((x) => x.seat === i).holeCards);
  check(views.every((v, i) => allCards.filter((_, j) => j !== i).flat().every((c) => !JSON.stringify(v).includes(`"${c}"`))), "other players' cards appear nowhere in a player's response");
  check(new Set(allCards.flat()).size === 6, "all dealt cards are different");
  check(views[0].hand.pot === 150 && views[0].hand.currentBet === 100, "blinds are posted", `pot ${views[0].hand.pot}`);
  check(views.filter((v) => v.hand.legalActions).length === 1, "only the player to act is offered actions");

  // --- Invalid and conflicting actions -----------------------------------------
  const bySeat = (seat) => players[seat];
  let h = views[0].hand;
  const actor = bySeat(h.toActSeat);
  const waiting = players.find((p) => p !== actor);
  check((await post(waiting, `${url}/action`, { version: h.version, action: { type: "call" } })).code === "not_your_turn", "acting out of turn is rejected");
  check((await post(actor, `${url}/action`, { version: h.version, action: { type: "check" } })).code === "invalid_action", "checking when facing a bet is rejected");
  check((await post(actor, `${url}/action`, { version: h.version, action: { type: "raise", amount: 150 } })).code === "invalid_amount", "a raise below the minimum is rejected");
  check((await post(actor, `${url}/action`, { version: h.version, action: { type: "raise", amount: 999999 } })).code === "invalid_amount", "betting more chips than you have is rejected");
  check((await post(actor, `${url}/action`, { version: h.version, action: { type: "raise", amount: 250.5 } })).status === 400, "a fractional bet is rejected");
  check((await post(actor, `${url}/action`, { version: h.version, action: { type: "steal" } })).status === 400, "an unknown action is rejected");
  check((await post(actor, `${url}/action`, { version: h.version + 5, action: { type: "call" } })).code === "stale", "an action for the wrong hand version is rejected");
  check((await post(waiting, `${url}/timeout`, { version: h.version })).code === "not_timed_out", "an opponent cannot be timed out before their time is up");
  check((await view(A)).hand.version === h.version, "none of the rejected requests changed the game");

  const burst = await Promise.all([1, 2, 3, 4].map(() => post(actor, `${url}/action`, { version: h.version, action: { type: "raise", amount: 300 } })));
  check(burst.filter((r) => r.status === 200).length === 1 && burst.filter((r) => r.code === "stale").length === 3, "the same raise sent four times at once is applied exactly once", burst.map((r) => r.status).join(","));
  h = (await view(A)).hand;
  check(h.currentBet === 300 && h.pot === 450, "the raise is reflected for everyone", `bet ${h.currentBet}, pot ${h.pot}`);
  check((await chipsOf(actor)) === 10000 - BUY_IN, "betting does not touch the account balance, only the table stack");

  // --- Play the hand to showdown -----------------------------------------------
  const playOut = async () => {
    for (let i = 0; i < 60; i++) {
      const cur = (await view(A)).hand;
      if (cur.result) return cur;
      const p = bySeat(cur.toActSeat);
      const legal = (await view(p)).hand.legalActions;
      const r = await post(p, `${url}/action`, { version: cur.version, action: { type: legal.canCheck ? "check" : "call" } });
      if (r.status !== 200) throw new Error(`action failed: ${JSON.stringify(r.json)}`);
    }
    throw new Error("hand did not finish");
  };
  let done = await playOut();
  const early = await post(B, `${url}/start`);
  check(early.code === "too_soon", "the next hand cannot be dealt before a short pause", early.code ?? early.status);
  check(done.result.endedBy === "showdown" && done.board.length === 5, "hand runs through flop, turn and river to a showdown");
  check(done.players.every((p) => p.holeCards?.length === 2), "hands are revealed at showdown");
  const potTotal = done.result.pots.reduce((s, p) => s + p.amount, 0);
  check(potTotal === 900, "pot equals everything that was bet", potTotal);
  let after = await view(B);
  check(after.seats.reduce((s, x) => s + Number(x.stack), 0) === 3 * BUY_IN, "seat stacks after settlement add up to all buy-ins", after.seats.map((x) => x.stack).join("+"));
  check(after.seats.every((x) => Number(x.stack) === done.players.find((p) => p.seat === x.seat_no).stack), "each seat stack matches the hand result");
  const stats = (await sb.from("player_stats").select("hands_played, hands_won, user_id").in("user_id", after.seats.map((x) => x.user_id))).data;
  check(stats.length === 3 && stats.every((s) => s.hands_played === 1) && stats.some((s) => s.hands_won === 1), "player statistics are updated");
  check((await post(A, `${url}/action`, { version: done.version, action: { type: "check" } })).code === "no_hand", "no actions are accepted after the hand ends");
  check((await post(A, `${url}/timeout`, { version: done.version })).code === "no_hand", "a timeout cannot be claimed when no hand is running");

  // --- Second hand: side pot via all-in, and leaving mid-hand ---------------------
  await new Promise((r) => setTimeout(r, 3000));
  check((await post(B, `${url}/start`)).status === 200, "next hand is dealt");
  h = (await view(A)).hand;
  check(h.dealerSeat !== done.dealerSeat, "dealer button moved", `${done.dealerSeat} -> ${h.dealerSeat}`);
  // A guest who is not about to act (the host can always see their own table).
  const leaver = players.find((p, seat) => seat !== h.toActSeat && p !== A);
  const leave = await post(leaver, `${url}/leave`);
  check(leave.json?.result === "leaving", "leaving mid-hand marks the player as leaving");
  check((await chipsOf(leaver)) === 10000 - BUY_IN, "a leaving player is not paid until the hand ends");
  const shover = bySeat(h.toActSeat);
  check((await post(shover, `${url}/action`, { version: h.version, action: { type: "allin" } })).status === 200, "a player goes all-in");
  done = await playOut();
  const leaverSeat = players.indexOf(leaver);
  check(done.players.find((p) => p.seat === leaverSeat).folded, "the leaving player was folded automatically");
  after = await view(A);
  check(!after.seats.some((x) => x.seat_no === leaverSeat), "the leaving player's seat is freed when the hand ends");
  const leaverFinal = done.players.find((p) => p.seat === leaverSeat).stack;
  check((await chipsOf(leaver)) === 10000 - BUY_IN + leaverFinal, "the leaving player is cashed out with their final stack", leaverFinal);
  check(done.result.pots.every((p) => p.winners.reduce((s, w) => s + w.amount, 0) === p.amount), "every pot pays out exactly what it holds");
  check((await get(leaver, url)).status === 404, "after leaving, the private table is invisible again");

  // --- Leaving between hands and closing ------------------------------------------
  const remaining = players.filter((p) => p !== leaver);
  const nonHost = remaining.find((p) => p !== A) ?? remaining[0];
  check((await post(nonHost, `${url}/close`)).code === (nonHost === A ? undefined : "not_table_owner"), "only the host can close the table");
  if (after.seats.some((x) => x.user_id && x.seat_no === players.indexOf(nonHost)) && nonHost !== A) {
    const before = await chipsOf(nonHost);
    const stack = Number(after.seats.find((x) => x.seat_no === players.indexOf(nonHost)).stack);
    check((await post(nonHost, `${url}/leave`)).json?.result === "left", "leaving between hands is immediate");
    check((await chipsOf(nonHost)) === before + stack, "the stack returns to the balance", stack);
  }
  const closed = await post(A, `${url}/close`);
  check(closed.status === 200 || closed.code === "table_not_found", "host closes the table", closed.code);
  check((await totalBalance()) === 30000, "after everyone has cashed out, the three balances add up to exactly 30,000", await totalBalance());
  check((await post(A, `${url}/join`, {})).code === "table_not_found", "a closed table cannot be joined");

  // --- Direct attacks on the database with a real player's token --------------------
  const { data: auth } = await sb.auth.signInWithPassword({ email: B.email, password: B.password });
  const r1 = await sb.rpc("game_load", { p_key: "guess", p_table_id: T.id });
  check(!!r1.error, "DB: game functions refuse a wrong server key", r1.error?.message);
  const r2 = await sb.rpc("game_abort_hand", { p_key: null, p_hand_id: T.id });
  check(!!r2.error, "DB: game functions refuse a missing server key", r2.error?.message);
  const r3 = await sb.schema("private").from("hands").select("*");
  check(!!r3.error, "DB: the private schema is not reachable through the API", r3.error?.message);
  const r4 = await sb.from("table_seats").update({ stack: 999999 }).eq("user_id", auth.user.id);
  check(!!r4.error, "DB: players cannot edit seat stacks", r4.error?.message);
  const r5 = await sb.from("poker_tables").update({ buy_in: 1 }).eq("id", T.id);
  check(!!r5.error, "DB: players cannot edit tables", r5.error?.message);
  const r6 = await sb.rpc("abort_stale_hands");
  check(!!r6.error, "DB: players cannot run the maintenance sweep", r6.error?.message);
  const ledger = (await sb.from("chip_transactions").select("amount, kind")).data;
  const sum = ledger.reduce((s, t) => s + Number(t.amount), 0);
  check(sum === (await chipsOf(B)), "the player's chip history adds up exactly to their balance", `${ledger.length} entries, ${sum}`);

  await outsider.close();
  console.log(`\nTest accounts created: ${players.map((p) => p.username).join(", ")}`);
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
