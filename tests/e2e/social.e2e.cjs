/**
 * End-to-end test of the daily bonus, leaderboard, public profiles and table
 * chat against a running site and a real Supabase project. Two browsers, one
 * phone-sized. Creates throwaway accounts named zagtest_*.
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/social.e2e.cjs
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SCREENSHOT_DIR;
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const proxied = !!process.env.BROWSER_PROXY;

(async () => {
  const browser = await chromium.launch(proxied ? { proxy: { server: process.env.BROWSER_PROXY, bypass: "localhost,127.0.0.1" } } : {});
  const errors = [];
  const players = [];
  for (const [tag, viewport] of [["a", { width: 1366, height: 800 }], ["b", { width: 390, height: 844 }]]) {
    const u = { tag, username: `zagtest_${id}${tag}`, email: `zagtest_${id}${tag}@example.com`, password: `pw-${id}-${tag}-Zz!` };
    const ctx = await browser.newContext({ viewport, ignoreHTTPSErrors: proxied });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
    page.on("dialog", (d) => d.accept().catch(() => {}));
    await page.goto(`${BASE}/register`);
    await page.fill("[name=username]", u.username);
    await page.fill("[name=email]", u.email);
    await page.fill("[name=password]", u.password);
    await page.click("main button[type=submit]");
    await page.waitForURL("**/profile?welcome=1", { timeout: 30000 });
    players.push({ ...u, ctx, page });
  }
  const [A, B] = players;
  const chipsOf = async (p) => Number((await sb.from("profiles").select("chips").eq("username", p.username).single()).data.chips);
  const post = async (p, url, data = {}) => {
    const res = await p.ctx.request.post(`${BASE}${url}`, { data, failOnStatusCode: false });
    const json = await res.json().catch(() => null);
    return { status: res.status(), json, code: json?.error?.code };
  };

  // --- Daily bonus ------------------------------------------------------------
  await A.page.goto(`${BASE}/lobby`);
  const claim = A.page.getByRole("button", { name: /^Claim 1,000/ });
  await claim.waitFor({ timeout: 15000 });
  check(true, "the lobby offers the daily bonus to a new player");
  await claim.click();
  await A.page.getByText("1,000 chips added to your balance").waitFor({ timeout: 15000 });
  check((await chipsOf(A)) === 11000, "claiming adds exactly 1,000 chips", await chipsOf(A));
  await A.page.locator("header").getByText("11,000").first().waitFor({ timeout: 10000 });
  check(true, "the header balance updates without a reload");
  check(await A.page.getByRole("button", { name: "Claimed" }).isDisabled(), "the claim button is disabled afterwards");
  check((await post(A, "/api/bonus")).code === "bonus_not_ready", "a second claim is refused by the server");
  await A.page.reload();
  await A.page.getByText(/Next bonus in 23h \d\dm/).waitFor({ timeout: 15000 });
  check(true, "after a reload the countdown to the next bonus is shown", (await A.page.getByText(/Next bonus in/).textContent()).trim());

  const burst = await Promise.all([1, 2, 3, 4, 5].map(() => post(B, "/api/bonus")));
  check(burst.filter((r) => r.status === 200).length === 1 && (await chipsOf(B)) === 11000,
    "five simultaneous claims pay out once", burst.map((r) => r.status).join(","));
  const anonCtx = await browser.newContext({ ignoreHTTPSErrors: proxied });
  const anonBonus = await anonCtx.request.post(`${BASE}/api/bonus`, { data: {}, failOnStatusCode: false });
  check(anonBonus.status() === 401, "the bonus needs a login", anonBonus.status());

  await A.page.goto(`${BASE}/profile`);
  await A.page.getByText("Daily bonus").nth(1).waitFor({ timeout: 15000 });
  check((await A.page.locator("main").innerText()).includes("+1,000"), "the bonus appears in the chip history");

  // --- Leaderboard and public profiles (no login needed) -----------------------
  const anon = await anonCtx.newPage();
  await anon.goto(`${BASE}/leaderboard`);
  await anon.locator("tbody tr").first().waitFor({ timeout: 15000 });
  const board = await anon.locator("tbody tr").evaluateAll((rows) => rows.map((r) => ({
    rank: Number(r.cells[0].innerText), name: r.cells[1].innerText.trim(), value: Number(r.cells[2].innerText.replace(/[^0-9]/g, "")),
  })));
  check(board.length > 0 && board.length <= 50, "the leaderboard is public and lists up to 50 players", `${board.length} rows`);
  check(board.every((r, i) => r.rank === i + 1), "ranks run 1, 2, 3, …");
  check(board.every((r, i) => i === 0 || r.value <= board[i - 1].value), "players are ordered by chips, highest first", `top: ${board[0].name} ${board[0].value}`);
  await anon.getByRole("link", { name: "Hands won" }).click();
  await anon.waitForURL("**/leaderboard?sort=hands_won");
  await anon.locator("thead", { hasText: "Hands won" }).waitFor();
  const byWins = await anon.locator("tbody tr").evaluateAll((rows) => rows.map((r) => Number(r.cells[2].innerText.replace(/[^0-9]/g, ""))));
  check(byWins.every((v, i) => i === 0 || v <= byWins[i - 1]), "the 'Hands won' ranking is ordered by hands won");
  await anon.locator("tbody tr a").first().click();
  await anon.waitForURL("**/players/*");
  await anon.getByText("Hands played").waitFor();
  check(true, "a leaderboard row opens that player's public profile");

  await anon.goto(`${BASE}/players/${A.username.toUpperCase()}`);
  await anon.locator("h1", { hasText: A.username }).waitFor({ timeout: 15000 });
  const publicText = await anon.locator("main").innerText();
  check(publicText.includes("11,000") && publicText.includes("Ranked #"), "a public profile shows chips, rank and statistics");
  check(!publicText.includes("@example.com"), "a public profile does not show the email address");
  // The shell is already streaming when the lookup finishes, so the status is
  // 200; what matters is that the visitor gets the not-found screen.
  await anon.goto(`${BASE}/players/nobody_${id}`);
  await anon.getByText("This hand was folded").waitFor({ timeout: 15000 });
  check((await anon.locator("meta[name=robots][content*=noindex]").count()) > 0, "an unknown player shows the not-found screen, marked not to be indexed");
  if (SHOTS) { await anon.goto(`${BASE}/leaderboard`); await anon.locator("tbody tr").first().waitFor(); await anon.screenshot({ path: `${SHOTS}/leaderboard.png` }); }

  // --- Table chat ----------------------------------------------------------------
  await A.page.goto(`${BASE}/lobby`);
  await A.page.getByRole("button", { name: "Create table" }).click();
  await A.page.fill("[name=name]", `Chat ${id}`);
  await A.page.locator("select").nth(2).selectOption("20");
  await A.page.getByRole("button", { name: /Create and sit down/ }).click();
  await A.page.waitForURL("**/table/*", { timeout: 30000 });
  const tableId = A.page.url().split("/table/")[1];
  const code = ((await A.page.getByTitle("Copy room code").textContent()) ?? "").trim();
  await B.page.goto(`${BASE}/join/${code}`);
  await B.page.getByRole("button", { name: /Take a seat/ }).click();
  await B.page.waitForURL("**/table/*");
  await B.page.locator("[data-seat]:visible", { hasText: A.username }).waitFor({ timeout: 15000 });

  const rude = `<img src=x onerror="window.__xss=1"> bloody hell, what a damn river 😀 ${id}`;
  await sleep(3000); // let both live feeds become active
  await A.page.getByLabel("Message", { exact: true }).fill(rude);
  let t0 = Date.now();
  await A.page.getByRole("button", { name: "Send message" }).click();
  await A.page.locator("aside li", { hasText: `damn river 😀 ${id}` }).waitFor({ timeout: 10000 });
  check(true, "a sent message appears in the sender's chat");
  // On the phone the panel is closed: a dot marks the unread message.
  await B.page.getByRole("button", { name: /new messages/ }).waitFor({ timeout: 15000 });
  const latency = Date.now() - t0;
  check(true, "the other player's phone shows an unread marker without reloading", `${latency} ms`);
  await B.page.getByRole("button", { name: /Chat and hand history/ }).click();
  const received = B.page.locator("aside li", { hasText: `damn river 😀 ${id}` });
  await received.waitFor({ timeout: 10000 });
  check((await received.innerText()).includes(rude), "the message arrives word for word, uncensored");
  check((await received.innerText()).includes(A.username), "messages show who sent them");
  check((await B.page.locator("aside img").count()) === 0 && !(await B.page.evaluate(() => window.__xss)),
    "HTML in a message is shown as text and never runs");
  if (SHOTS) await B.page.screenshot({ path: `${SHOTS}/chat-mobile.png` });

  await B.page.getByLabel("Message", { exact: true }).fill(`right back at you ${id}`);
  await B.page.getByLabel("Message", { exact: true }).press("Enter");
  await A.page.locator("aside li", { hasText: `right back at you ${id}` }).waitFor({ timeout: 10000 });
  check(true, "the reply reaches the first player live");
  if (SHOTS) await A.page.screenshot({ path: `${SHOTS}/chat-desktop.png` });

  await A.page.getByRole("tab", { name: "Hand history" }).click();
  await A.page.getByText("The hand history appears here").waitFor({ timeout: 5000 });
  check(true, "the side panel switches between chat and hand history");

  // --- Chat rules -------------------------------------------------------------------
  const chatUrl = `/api/tables/${tableId}/chat`;
  check((await post(A, chatUrl, { body: "   " })).status === 400, "an empty message is rejected");
  check((await post(A, chatUrl, { body: "x".repeat(501) })).status === 400, "a message over 500 characters is rejected");
  check((await post(A, chatUrl, { body: "x".repeat(500) })).status === 200, "a 500-character message is accepted");
  await sleep(10500);
  const flood = [];
  for (let i = 0; i < 7; i++) flood.push(await post(A, chatUrl, { body: `flood ${i}` }));
  check(flood.filter((r) => r.status === 200).length === 5 && flood.at(-1).code === "chat_rate_limited",
    "more than five messages in ten seconds are refused", flood.map((r) => r.status).join(","));
  const outsider = await anonCtx.request.post(`${BASE}${chatUrl}`, { data: { body: "hi" }, failOnStatusCode: false });
  check(outsider.status() === 401, "chat needs a login", outsider.status());

  const { data: auth } = await sb.auth.signInWithPassword({ email: B.email, password: B.password });
  const forged = await sb.from("chat_messages").insert({ table_id: tableId, user_id: auth.user.id, username: A.username, body: "forged" });
  check(!!forged.error, "DB: messages cannot be inserted directly (no impersonation)", forged.error?.message);
  const edit = await sb.from("chat_messages").update({ body: "edited" }).eq("table_id", tableId);
  check(!!edit.error, "DB: messages cannot be edited", edit.error?.message);

  // B leaves: they can no longer post to or read the private table's chat.
  check((await post(B, `/api/tables/${tableId}/leave`)).json?.result === "left", "second player leaves the table");
  check((await post(B, chatUrl, { body: "still here?" })).code === "not_seated", "a player who has left cannot post");
  const peek = await sb.from("chat_messages").select("id").eq("table_id", tableId);
  check(!peek.error && peek.data.length === 0, "a player who has left can no longer read the private table's chat");

  await post(A, `/api/tables/${tableId}/close`);
  const total = (await chipsOf(A)) + (await chipsOf(B));
  check(total === 22000, "balances add up: two welcome grants plus two bonuses", total);
  check(errors.length === 0, "no browser errors", errors.slice(0, 3).join("; "));

  console.log(`\nTest accounts created: ${players.map((p) => p.username).join(", ")}`);
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
