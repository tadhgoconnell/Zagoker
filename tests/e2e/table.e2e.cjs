/**
 * End-to-end test of the live table screen. Three independent browsers
 * (one phone-sized) create a private room, join by invitation, and play
 * real hands through the UI with live updates, timers and reconnection.
 * Creates throwaway accounts named zagtest_*.
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/table.e2e.cjs
 *
 * Set BROWSER_PROXY if browsers need a proxy to reach Supabase.
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
/** Browser messages saying the Content Security Policy blocked something. */
const csp = [];
const watchCsp = (page) => page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text().slice(0, 160)); });
const check = (ok, label, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}${extra !== "" ? ` (${extra})` : ""}`);
};
const id = Math.random().toString(36).slice(2, 8);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (page, name) => SHOTS && page.screenshot({ path: `${SHOTS}/${name}.png` });

(async () => {
  const browser = await chromium.launch(
    process.env.BROWSER_PROXY ? { proxy: { server: process.env.BROWSER_PROXY, bypass: "localhost,127.0.0.1" } } : {},
  );
  const errors = [];
  const viewports = { a: { width: 1366, height: 800 }, b: { width: 390, height: 844 }, c: { width: 1024, height: 768 } };
  const players = [];
  for (const tag of ["a", "b", "c"]) {
    const u = { tag, username: `zagtest_${id}${tag}`, email: `zagtest_${id}${tag}@example.com`, password: `pw-${id}-${tag}-Zz!` };
    const ctx = await browser.newContext({ viewport: viewports[tag], ignoreHTTPSErrors: !!process.env.BROWSER_PROXY });
    const page = await ctx.newPage(); watchCsp(page);
    page.on("pageerror", (e) => errors.push(`${tag}: ${e.message}`));
    await page.goto(`${BASE}/register`);
    await page.fill("[name=username]", u.username);
    await page.fill("[name=email]", u.email);
    await page.fill("[name=password]", u.password);
    await page.click("main button[type=submit]");
    await page.waitForURL("**/profile?welcome=1", { timeout: 30000 });
    players.push({ ...u, ctx, page });
  }
  const [A, B, C] = players;
  globalThis.__players = players;
  const chipsOf = async (p) => Number((await sb.from("profiles").select("chips").eq("username", p.username).single()).data.chips);

  // Next.js keeps the previous page in the DOM, hidden, so only match visible elements.
  /** Clicks Leave and, if the "fold this hand?" dialog appears, confirms it. */
  async function leaveTable(page) {
    await page.locator("button[aria-label='Leave table']:visible").click();
    const yes = page.getByRole("button", { name: "Yes, leave" });
    if (await yes.waitFor({ timeout: 1500 }).then(() => true, () => false)) await yes.click();
  }
  const seatOf = (page, name) => page.locator("[data-seat]:visible", { hasText: name });
  const resultShown = (page) => page.locator("[data-result] p.font-semibold:visible").first().isVisible();
  const handNo = async (page) => Number(await page.locator("[data-hand-number]:visible").getAttribute("data-hand-number"));
  const waitHandAbove = async (page, n, timeout = 25000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if ((await handNo(page).catch(() => 0)) > n) return; await sleep(250); }
    throw new Error(`hand number stayed at ${n}`);
  };
  /** "handNumber:version" of the game as this page currently shows it. */
  const gameKey = (page) => page.locator("[data-table]:visible").evaluate((el) => `${el.dataset.handNumber}:${el.dataset.handVersion}`).catch(() => "");
  const waitKeyChange = async (page, before, timeout = 15000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) { if ((await gameKey(page)) !== before) return; await sleep(50); }
    throw new Error("the game did not advance on the observing screen");
  };
  /** The side panel opens on Chat; these checks read the hand history tab. */
  const showHistory = async (page) => {
    const tab = page.locator("[role=tab]:visible", { hasText: "Hand history" });
    const toggle = page.locator("button[aria-label^='Chat and hand history']:visible");
    // Wait for the table to finish loading: one of the two is then on screen.
    await tab.or(toggle).first().waitFor({ timeout: 20000 });
    if ((await tab.count()) === 0) {
      await page.locator("button[aria-label^='Chat and hand history']:visible").click();
      await tab.click();
      await page.locator("button[aria-label='Close panel']:visible").click();
    } else await tab.click();
  };
  const canAct = (p) => p.page.getByRole("button", { name: "Fold", exact: true }).isEnabled({ timeout: 200 }).catch(() => false);
  async function waitActor(among = players, timeout = 15000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      for (const p of among) if (!p.page.isClosed() && (await canAct(p))) return p;
      await sleep(150);
    }
    return null;
  }
  /** The player to act checks or calls. Returns ms until another browser saw it. */
  async function passiveStep(observer) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const p = await waitActor();
      if (!p) throw new Error("nobody can act");
      const watcher = observer && observer !== p && !observer.page.isClosed() ? observer : players.find((x) => x !== p && !x.page.isClosed());
      const before = await gameKey(watcher.page);
      const button = p.page.getByRole("button", { name: /^(Check|Call)/ });
      const t0 = Date.now();
      try {
        await button.click({ timeout: 3000 });
      } catch {
        continue; // the controls were replaced while we looked; pick the actor again
      }
      await waitKeyChange(watcher.page, before);
      return Date.now() - t0;
    }
    throw new Error("could not act");
  }
  async function playOut(observer) {
    const latencies = [];
    for (let i = 0; i < 40 && !(await resultShown(observer.page)); i++) {
      if (!(await waitActor(players.filter((p) => !p.page.isClosed()), 4000))) continue;
      latencies.push(await passiveStep(observer));
    }
    return latencies;
  }

  // --- Host creates a private table from the lobby -----------------------------
  await A.page.goto(`${BASE}/lobby`);
  await A.page.getByRole("button", { name: "Create table" }).click();
  await A.page.fill("[name=name]", `Live ${id}`);
  await A.page.locator("select").nth(0).selectOption("4");
  await A.page.locator("select").nth(1).selectOption("3"); // 50/100
  await A.page.locator("select").nth(2).selectOption("20"); // 2,000 chips
  await A.page.getByRole("button", { name: /Create and sit down/ }).click();
  await A.page.waitForURL("**/table/*", { timeout: 30000 });
  const tableUrl = A.page.url();
  await seatOf(A.page, A.username).waitFor();
  const code = ((await A.page.getByTitle("Copy room code").textContent()) ?? "").trim();
  check(/^[A-Z2-9]{8}$/.test(code), "host creates a private table from the lobby and is seated", code);
  check(await A.page.getByText("Waiting for players").isVisible(), "host sees 'Waiting for players'");
  check((await A.page.getByTitle("Live connection").count()) === 1, "host's screen reports a live connection");

  // --- Guests join by invitation link and by room code ---------------------------
  await B.page.goto(`${BASE}/join/${code}`);
  await B.page.getByText("You have been invited to a private table").waitFor({ timeout: 15000 });
  check(true, "invitation link shows the table details");
  let t0 = Date.now();
  await B.page.getByRole("button", { name: /Take a seat/ }).click();
  await seatOf(A.page, B.username).waitFor({ timeout: 10000 });
  const joinLatency = Date.now() - t0;
  check(true, "host sees the guest sit down without reloading", `${joinLatency} ms`);
  await B.page.waitForURL("**/table/*");

  await C.page.goto(`${BASE}/lobby`);
  await C.page.getByLabel("Room code").fill(code.toLowerCase());
  await C.page.getByRole("button", { name: "Find table" }).click();
  await C.page.getByRole("button", { name: /Take a seat/ }).click();
  await C.page.waitForURL("**/table/*");
  await Promise.all([seatOf(A.page, C.username).waitFor({ timeout: 10000 }), seatOf(B.page, C.username).waitFor({ timeout: 10000 })]);
  check(true, "third player joins with the room code typed into the lobby; both others see it live");
  for (const p of players) await showHistory(p.page);
  check(await B.page.getByText("Waiting for the host to start the game").first().isVisible(), "guests wait for the host to start");
  check((await B.page.getByRole("button", { name: "Start game" }).count()) === 0, "guests have no start button");

  // --- Host starts; cards are private ---------------------------------------------
  await A.page.getByRole("button", { name: "Start game" }).click();
  const ownCards = (page) => page.locator("[data-seat]:visible [role=img]:not([aria-label='Face-down card'])");
  await Promise.all(players.map((p) => ownCards(p.page).nth(1).waitFor({ timeout: 15000 })));
  check(true, "all three screens show the deal without reloading");
  const mine = await Promise.all(players.map((p) => ownCards(p.page).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))));
  check(mine.every((c) => c.length === 2), "each player sees exactly their own two cards", mine.map((c) => c.join(" + ")).join(" | "));
  const downCounts = await Promise.all(players.map((p) => p.page.locator("[data-seat]:visible [aria-label='Face-down card']").count()));
  check(downCounts.every((n) => n === 4), "opponents' cards are face down", downCounts.join(","));
  const html = await Promise.all(players.map((p) => p.page.content()));
  check(players.every((_, i) => mine.filter((_, j) => j !== i).flat().every((label) => !html[i].includes(`aria-label="${label}"`))),
    "no page contains another player's cards");
  check((await A.page.locator("[data-turn]:visible").count()) === 1 && (await A.page.locator("[data-turn]:visible").textContent()).match(/\d+s/) !== null,
    "the player to act is highlighted with a countdown");
  await shot(A.page, "table-desktop-preflop");
  await shot(B.page, "table-mobile-preflop");

  // --- Betting through the UI -------------------------------------------------------
  let first = await waitActor();
  check(!!first && (await Promise.all(players.map(canAct))).filter(Boolean).length === 1, "exactly one player has action buttons");
  // Build the raise from chips (blinds 50/100: chips of 50, 100, 250, 500, 1,000).
  const fp = first.page;
  const raiseBtn = fp.getByRole("button", { name: /^Raise/ });
  check(await raiseBtn.isDisabled(), "with no chips selected the raise button is disabled");
  await fp.getByRole("button", { name: "Add 50", exact: true }).click();
  await fp.getByText("Add 150 more (minimum 200)").waitFor({ timeout: 5000 });
  check(await raiseBtn.isDisabled(), "50 alone is below the minimum raise: the button stays disabled and says how much more is needed");
  await fp.getByRole("button", { name: "Remove 50" }).click();
  await fp.getByText("Tap chips to build your bet.").waitFor({ timeout: 5000 });
  check(true, "tapping a chip in the pile takes it back");
  await fp.getByRole("button", { name: "Add 250", exact: true }).click();
  await fp.getByRole("button", { name: "Add 100", exact: true }).click();
  const raiseText = (await raiseBtn.textContent()).trim();
  check(raiseText === "Raise to 350", "tapping the 250 and 100 chips makes a raise to 350", raiseText);
  // Double click: the second click must not cause a second action or an error.
  await raiseBtn.dblclick();
  const others = players.filter((p) => p !== first);
  await Promise.all(others.map((p) => p.page.locator("aside ol li", { hasText: "raises to" }).first().waitFor({ state: "attached", timeout: 10000 })));
  check(true, "the chip raise appears on the other screens", raiseText);
  check((await others[0].page.locator("aside ol li", { hasText: "raises to 350" }).count()) === 1, "the other screens show exactly 350");
  check((await others[0].page.locator("aside ol li", { hasText: "raises to" }).count()) === 1, "a double click is applied once");
  await sleep(800);
  check((await first.page.locator("div[role=alert].rounded-xl").count()) === 0, "no error is shown for the duplicate click");

  // --- Reconnection mid-hand -----------------------------------------------------------
  const bCardsBefore = await ownCards(B.page).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  await B.page.reload();
  await ownCards(B.page).nth(1).waitFor({ timeout: 15000 });
  await showHistory(B.page);
  const bCardsAfter = await ownCards(B.page).evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
  check(JSON.stringify(bCardsBefore) === JSON.stringify(bCardsAfter), "after a page reload mid-hand the player gets the same cards back", bCardsAfter.join(" + "));

  // Make sure it is not the soon-to-be-offline player's turn.
  for (let i = 0; i < 3 && (await waitActor(players, 5000)) === B; i++) await passiveStep(A);
  await B.ctx.setOffline(true);
  await sleep(1500);
  let acted = 0;
  for (let i = 0; i < 2; i++) {
    const p = await waitActor([A, C], 3000);
    if (!p) break;
    await passiveStep(p === A ? C : A);
    acted++;
  }
  const keyOnA = await gameKey(A.page);
  await B.ctx.setOffline(false);
  for (let i = 0; i < 200 && (await gameKey(B.page)) !== keyOnA; i++) await sleep(100);
  check((await gameKey(B.page)) === keyOnA, "the reconnected screen shows the same game state as the others", keyOnA);
  check(true, "a player who lost their connection catches up automatically when it returns", `${acted} actions missed`);

  const latencies = await playOut(A);
  await Promise.all(players.map((p) => p.page.locator("[data-result] p.font-semibold").first().waitFor({ timeout: 15000 })));
  const outcome = await A.page.locator("[data-result]:visible").innerText();
  check(/wins|split/.test(outcome), "the result is announced on every screen", outcome.replace(/\n/g, "; "));
  if (latencies.length) {
    const sorted = latencies.slice().sort((a, b) => a - b);
    check(sorted[sorted.length - 1] < 5000, "actions reach the other browsers quickly",
      `median ${sorted[Math.floor(sorted.length / 2)]} ms, slowest ${sorted[sorted.length - 1]} ms over ${sorted.length} actions`);
  }
  await shot(A.page, "table-desktop-showdown");
  await shot(B.page, "table-mobile-showdown");

  // --- Next hand deals itself ---------------------------------------------------------
  await waitHandAbove(A.page, 1);
  await Promise.all(players.map((p) => ownCards(p.page).nth(1).waitFor({ timeout: 15000 })));
  check(true, "the next hand is dealt automatically on all screens");
  check((await A.page.locator("aside ol li", { hasText: "posts the" }).count()) === 2, "exactly one new hand was started (blinds posted once)");

  // --- Disconnection and the turn timer ---------------------------------------------------
  const closedAt = Date.now();
  await C.page.close();
  await seatOf(A.page, C.username).getByTitle("Disconnected").waitFor({ timeout: 40000 });
  check(true, "a closed browser is shown as disconnected to the others", `${Date.now() - closedAt} ms`);
  // Play on; when it is the absent player's turn nobody can act until the timer fires.
  t0 = Date.now();
  let timedOut = false;
  for (let i = 0; i < 30 && !timedOut; i++) {
    if (await seatOf(A.page, C.username).getByText("Away").isVisible().catch(() => false)) { timedOut = true; break; }
    if (await resultShown(A.page)) { await sleep(1000); continue; }
    const p = await waitActor([A, B], 2500);
    if (p) await passiveStep(p === A ? B : A);
  }
  if (!timedOut) {
    await seatOf(A.page, C.username).getByText("Away").waitFor({ timeout: 60000 }).then(() => (timedOut = true)).catch(() => {});
  }
  check(timedOut, "when the absent player's time runs out they are acted for and marked Away", `${Math.round((Date.now() - t0) / 1000)} s`);
  check((await chipsOf(C)) === 8000, "the absent player keeps their seat and chips");

  // The game continues without them.
  await playOut(A);
  const before = await handNo(A.page);
  await waitHandAbove(A.page, before);
  await ownCards(A.page).nth(1).waitFor({ timeout: 15000 });
  check((await seatOf(A.page, C.username).locator("[role=img]").count()) === 0, "the away player is not dealt into the next hand");

  // --- Coming back ---------------------------------------------------------------------------
  C.page = await C.ctx.newPage();
  await C.page.goto(tableUrl);
  await C.page.getByRole("button", { name: "I'm back" }).click({ timeout: 20000 });
  await seatOf(A.page, C.username).getByText("Away").waitFor({ state: "detached", timeout: 15000 });
  check(true, "the player reopens the table, presses 'I'm back', and the others see it");
  await playOut(A);
  await ownCards(C.page).nth(1).waitFor({ timeout: 30000 });
  check(true, "the returning player is dealt into the following hand");

  // --- Leaving -------------------------------------------------------------------------------------
  await leaveTable(B.page);
  await playOut(A).catch(() => {});
  await B.page.waitForURL("**/lobby", { timeout: 40000 }).catch(async () => {
    // Left mid-hand: the seat is released when the hand ends.
    await B.page.goto(`${BASE}/lobby`);
  });
  await seatOf(A.page, B.username).waitFor({ state: "detached", timeout: 40000 });
  check(true, "a player leaves and their seat empties on the other screens");
  const bChips = await chipsOf(B);
  check(bChips > 0 && bChips !== 8000, "the leaver's stack is back in their balance", bChips);
  check(!(await B.page.getByText("You have a seat at a table").isVisible().catch(() => false)), "the lobby no longer says they have a seat");

  // --- Public table: live lobby and automatic start ------------------------------------------------
  await B.page.getByRole("button", { name: "Create table" }).click();
  await B.page.fill("[name=name]", `Public ${id}`);
  await B.page.locator("select").nth(2).selectOption("20");
  await B.page.getByText("Listed in the lobby").click();
  const lobbyCtx = await browser.newContext({ storageState: await C.ctx.storageState(), ignoreHTTPSErrors: !!process.env.BROWSER_PROXY });
  await B.page.getByRole("button", { name: /Create and sit down/ }).click();
  await B.page.waitForURL("**/table/*", { timeout: 30000 });
  const publicUrl = B.page.url();
  await B.page.locator("[data-table]:visible").getByText("Waiting for players").waitFor({ timeout: 15000 });
  check(true, "a public table waits for a second player");

  // The others leave the private table, then one joins the public one from the lobby.
  for (const p of [C, A]) {
    await leaveTable(p.page);
    await playOut(p === C ? A : C).catch(() => {});
    await p.page.waitForURL("**/lobby", { timeout: 45000 }).catch(() => p.page.goto(`${BASE}/lobby`));
  }
  await C.page.goto(`${BASE}/lobby`);
  const row = C.page.locator("li", { hasText: `Public ${id}` });
  await row.waitFor({ timeout: 15000 });
  check((await row.textContent()).includes("1/6"), "the public table is listed in the lobby with its player count", (await row.innerText()).replace(/\n/g, " "));
  await row.getByRole("link", { name: "Join" }).click();
  await C.page.waitForURL("**/table/*");
  check(C.page.url() === publicUrl, "joining from the lobby opens that table");
  await C.page.getByRole("button", { name: /^Sit in seat/ }).first().click();
  await Promise.all([B, C].map((p) => ownCards(p.page).nth(1).waitFor({ timeout: 20000 })));
  check(true, "at a public table the first hand starts by itself once two players sit down");
  await shot(C.page, "table-public");

  // --- The host closes the table in the middle of a hand ---------------------------------------------
  await B.page.locator("button[aria-label='Delete table']:visible").click();
  await B.page.getByText("The hand in progress is cancelled").waitFor({ timeout: 5000 });
  check(true, "the host can close the table mid-hand, with a clear warning");
  await B.page.getByRole("dialog").getByRole("button", { name: "Delete table" }).click();
  await B.page.waitForURL("**/lobby", { timeout: 20000 });
  await C.page.getByText("This table is not available").waitFor({ timeout: 20000 });
  check(true, "the other player's screen shows the table has closed");
  let total = 0;
  for (let i = 0; i < 40; i++) {
    total = (await Promise.all(players.map(chipsOf))).reduce((x, y) => x + y, 0);
    if (total === 30000) break;
    const p = await waitActor([B, C], 1000);
    if (p) await passiveStep().catch(() => {});
    else await sleep(1000);
  }
  check(total === 30000, "after everyone leaves, the three balances add up to exactly 30,000", total);
  check(errors.length === 0, "no browser errors", errors.slice(0, 3).join("; "));

  await lobbyCtx.close();
  console.log(`\nTest accounts created: ${players.map((p) => p.username).join(", ")}`);
  check(csp.length === 0, "the Content Security Policy blocked nothing the site needs", csp.slice(0, 2).join(" | "));
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch(async (e) => {
  console.error(e);
  // Leave a picture of every screen to show what went wrong.
  if (SHOTS) for (const [i, p] of (globalThis.__players ?? []).entries()) await p.page.screenshot({ path: `${SHOTS}/failure-${i}.png` }).catch(() => {});
  process.exit(1);
});
