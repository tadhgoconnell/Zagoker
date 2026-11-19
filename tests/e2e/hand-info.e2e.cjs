/**
 * The ☰ menu's hand rankings page, and the player's current hand shown
 * above their cards (checked in a practice game, which needs no account).
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/hand-info.e2e.cjs
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HANDS = ["Royal Flush", "Straight Flush", "Four of a Kind", "Full House", "Flush", "Straight", "Three of a Kind", "Two Pair", "One Pair", "High Card"];

(async () => {
  const browser = await chromium.launch(proxied ? { proxy: { server: process.env.BROWSER_PROXY, bypass: "localhost,127.0.0.1" } } : {});
  const ctx = await browser.newContext({ ...devices["iPhone 13"], ignoreHTTPSErrors: proxied });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // --- ☰ menu -> hand rankings ---
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  // Tap until the menu opens (a tap before the page is interactive does nothing).
  for (let i = 0; i < 5 && !(await page.locator("#mobile-menu").isVisible()); i++) {
    await page.click('button[aria-label="Open menu"]');
    await page.locator("#mobile-menu").waitFor({ timeout: 2000 }).catch(() => {});
  }
  await page.locator("#mobile-menu a", { hasText: "Hand rankings" }).click();
  await page.waitForURL("**/hand-rankings");
  check(true, "the ☰ menu has a 'Hand rankings' button that opens the page");
  const titles = await page.locator("main ol h2").allInnerTexts();
  check(JSON.stringify(titles) === JSON.stringify(HANDS), "all ten hands are listed, best first", titles.join(" > "));
  check((await page.locator("main ol [role=img]").count()) === 50, "each hand has a five-card example");
  check((await page.locator("main").innerText()).includes("2.60%"), "odds are shown (Full House 2.60%)");
  check(!(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), "no sideways scrolling on a phone");
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/hand-rankings-phone.png`, fullPage: true });

  // --- live hand label in a practice game ---
  await page.goto(`${BASE}/practice`);
  await page.getByRole("button", { name: "1", exact: true }).click();
  await page.getByRole("button", { name: "Deal me in" }).click();
  const label = page.locator("[data-live-hand]:visible");
  await label.waitFor({ timeout: 20000 });
  const pre = (await label.innerText()).trim();
  check(/^(Pair of \w+|High Card, \w+)$/.test(pre), "before the flop your hole cards are described above them", pre);
  const box = await label.boundingBox();
  const cardsBox = await page.locator("[data-seat]:visible [role=img]:not([aria-label='Face-down card'])").first().boundingBox();
  check(box && cardsBox && box.y + box.height <= cardsBox.y + cardsBox.height / 2 && box.y < cardsBox.y, "the label sits above your cards");
  check((await page.locator("[data-live-hand]").count()) === 1, "only your own seat has the label (the bot's hand is not described)");

  // Check/call through to the flop and see the description update.
  let flopLabel = null;
  for (let i = 0; i < 80 && !flopLabel; i++) {
    const btn = page.getByRole("button", { name: /^(Check|Call)/ });
    if (await btn.isEnabled({ timeout: 100 }).catch(() => false)) await btn.click().catch(() => {});
    const board = await page.locator("[aria-label='Community cards'] [role=img]").count();
    if (board >= 3 && (await label.isVisible().catch(() => false))) flopLabel = (await label.innerText()).trim();
    await sleep(300);
  }
  if (flopLabel) {
    check(/^(Royal Flush|Straight Flush|Four of a Kind|Full House|Flush|Straight|Three of a Kind|Two Pair|Pair of|High Card)/.test(flopLabel), "after the flop it describes your best five cards", flopLabel);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/live-hand-phone.png` });
  } else {
    console.log("SKIP - the hand ended before the flop (the bot folded or you were all-in)");
  }
  check(errors.length === 0, "no browser errors", errors.slice(0, 2).join("; "));
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
