/**
 * Blackjack and roulette with the real game server and database: a guest
 * plays a few hands and spins, and the balance always matches what the
 * games reported. Creates one throwaway zagtest_* guest.
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/casino.e2e.cjs
 */
const { chromium, devices } = require("playwright");

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SCREENSHOT_DIR;
const proxied = !!process.env.BROWSER_PROXY;
let failed = 0;
const check = (ok, label, extra = "") => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"} - ${label}${extra !== "" ? ` (${extra})` : ""}`);
};
const chips = (text) => Number(String(text).replace(/[^0-9]/g, ""));

(async () => {
  const browser = await chromium.launch(proxied ? { proxy: { server: process.env.BROWSER_PROXY, bypass: "localhost,127.0.0.1" } } : {});
  const ctx = await browser.newContext({ ...devices["iPad (gen 7) landscape"], ignoreHTTPSErrors: proxied });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) errors.push(`CSP: ${m.text()}`); });

  await page.goto(`${BASE}/play`);
  await page.fill("[name=username]", `zagtest_${Date.now().toString(36).slice(-6)}c`);
  await page.click("main button[type=submit]");
  await page.waitForURL("**/lobby", { timeout: 30000 });
  check(await page.getByRole("link", { name: "Blackjack" }).first().isVisible(), "the lobby links to blackjack");

  // --- Blackjack: play 5 hands with simple strategy. ---
  await page.goto(`${BASE}/blackjack`);
  let balance = chips(await page.locator("[data-balance]").innerText());
  check(balance === 10000, "a new guest starts blackjack with the shared 10,000 chips", balance);
  for (let hand = 0; hand < 5; hand++) {
    const dealt = page.waitForResponse((r) => r.url().includes("/api/casino/blackjack") && r.request().method() === "POST");
    if (hand === 0) {
      await page.getByRole("button", { name: "Add 100 chip" }).click();
      await page.getByRole("button", { name: "Deal", exact: true }).click();
    } else {
      await page.getByRole("button", { name: /^Same bet/ }).click();
    }
    await dealt;
    await page.waitForTimeout(200);
    for (let k = 0; k < 10; k++) {
      await page.waitForTimeout(300);
      const stand = page.getByRole("button", { name: /^Stand/ });
      if (!(await stand.isVisible().catch(() => false))) break;
      const total = parseInt((await page.locator("[data-hand] .font-mono").first().innerText()).split("/").pop());
      if (total < 15) await page.getByRole("button", { name: /^Hit/ }).click();
      else await stand.click();
    }
    await page.locator("[data-result]").waitFor({ timeout: 15000 });
    const net = Number(await page.locator("[data-result]").getAttribute("data-result"));
    const after = chips(await page.locator("[data-balance]").innerText());
    check(after === balance + net, `blackjack hand ${hand + 1}: balance moved by exactly the result`, `${balance} ${net >= 0 ? "+" : ""}${net} = ${after}`);
    balance = after;
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/casino-blackjack.png` });

  // --- Roulette: the same balance carries over. ---
  await page.goto(`${BASE}/roulette`);
  await page.waitForTimeout(500);
  const header = chips(await page.locator("header").getByTitle("Your virtual chips").first().innerText());
  check(header === balance, "roulette starts from the balance blackjack left", `${header} vs ${balance}`);
  for (let spin = 0; spin < 3; spin++) {
    if (spin === 0) {
      await page.getByRole("button", { name: "Use 100 chip" }).click();
      await page.locator('[data-spot="red"]').click();
      await page.getByRole("button", { name: "Use 25 chip" }).click();
      await page.locator('[data-spot="number:17"]').click();
      await page.getByRole("button", { name: /^Spin/ }).click();
    } else {
      await page.getByRole("button", { name: /^Same again/ }).click();
    }
    await page.getByText("No more bets").waitFor({ timeout: 10000 });
    await page.locator("[data-net]").waitFor({ timeout: 15000 });
    const net = Number(await page.locator("[data-net]").getAttribute("data-net"));
    const after = chips(await page.locator("[data-balance]").innerText());
    check(after === balance + net, `roulette spin ${spin + 1}: balance moved by exactly the result`, `${balance} ${net >= 0 ? "+" : ""}${net} = ${after}`);
    balance = after;
    await page.waitForTimeout(300);
  }
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/casino-roulette.png` });

  // --- And it is the poker balance too. ---
  await page.goto(`${BASE}/profile`);
  await page.waitForTimeout(1000);
  const profile = chips(await page.locator("header").getByTitle("Your virtual chips").first().innerText());
  check(profile === balance, "the header balance everywhere matches", `${profile} vs ${balance}`);

  check(errors.length === 0, "no browser errors or blocked resources", errors.slice(0, 3).join("; "));
  await browser.close();
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  process.exit(failed ? 1 : 0);
})();
