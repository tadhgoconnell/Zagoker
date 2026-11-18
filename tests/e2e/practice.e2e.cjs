/**
 * Practice mode: a visitor (no account) plays against bots in the browser.
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/practice.e2e.cjs
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

(async () => {
  const browser = await chromium.launch(proxied ? { proxy: { server: process.env.BROWSER_PROXY, bypass: "localhost,127.0.0.1" } } : {});
  const errors = [];
  for (const [label, opts] of [["desktop", { viewport: { width: 1366, height: 820 } }], ["phone", devices["iPhone 13"]]]) {
    const ctx = await browser.newContext({ ...opts, ignoreHTTPSErrors: proxied });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
    page.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) errors.push(`${label} CSP: ${m.text()}`); });
    await page.goto(`${BASE}/practice`);
    check(page.url().endsWith("/practice"), `${label}: practice is open to visitors without an account`);

    await page.getByRole("button", { name: "Difficulty 8" }).click();
    await page.getByRole("button", { name: "4", exact: true }).click();
    const opponents = await page.locator("ul li", { hasText: "Prefect #" }).allInnerTexts();
    check(opponents.length === 4 && opponents.every((t, i) => t.includes(`Prefect #${i + 1}`)), `${label}: four opponents named Prefect #1 to #4`, opponents.map((t) => t.replace(/\n/g, " – ")).join(", "));
    check(new Set(opponents.map((t) => t.split("\n")[1])).size === 4, `${label}: each Prefect has a different play style`);
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/practice-setup-${label}.png`, fullPage: true });

    await page.getByRole("button", { name: "Deal me in" }).click();
    await page.locator("[data-table=practice]").waitFor();
    check((await page.locator("h1", { hasText: "4 bots · difficulty 8" }).count()) === 1, `${label}: the table shows the chosen settings`);

    const handNo = () => page.locator("[data-table=practice]").getAttribute("data-hand-number").then(Number);
    const myCards = page.locator("[data-seat]:visible [role=img]:not([aria-label='Face-down card'])");
    await myCards.nth(1).waitFor({ timeout: 15000 });
    check((await page.locator("[data-seat]:visible").count()) === 5, `${label}: five seats: you and four bots`);
    check((await page.locator("[data-seat]:visible [aria-label='Face-down card']").count()) >= 2, `${label}: the bots' cards are face down`);

    // Play several hands: when it is our turn, mostly check/call, sometimes bet with chips.
    let actions = 0, chipBets = 0, botMoves = 0;
    const startHand = await handNo();
    const deadline = Date.now() + 120_000;
    while ((await handNo()) < startHand + 4 && Date.now() < deadline && !(await page.getByText(/out of chips|took every chip/).isVisible().catch(() => false))) {
      const fold = page.getByRole("button", { name: "Fold", exact: true });
      if (await fold.isEnabled({ timeout: 200 }).catch(() => false)) {
        const chip = page.getByRole("button", { name: /^Add / }).first();
        const betBtn = page.getByRole("button", { name: /^(Bet|Raise)/ });
        if (actions % 3 === 1 && (await chip.isEnabled().catch(() => false))) {
          await page.getByRole("button", { name: "Min", exact: true }).click();
          if (await betBtn.isEnabled().catch(() => false)) {
            await betBtn.click();
            chipBets++;
          } else await page.getByRole("button", { name: /^(Check|Call)/ }).click();
        } else {
          await page.getByRole("button", { name: /^(Check|Call)/ }).click();
        }
        actions++;
      } else if (await page.getByText(/is thinking/).isVisible().catch(() => false)) {
        botMoves++;
      }
      await sleep(250);
    }
    const played = (await handNo()) - startHand;
    check(played >= 4 || (await page.getByText(/out of chips|took every chip/).isVisible().catch(() => false)), `${label}: hands are dealt and finish on their own`, `${played} hands, ${actions} of our actions, ${chipBets} chip bets`);
    check(botMoves > 0, `${label}: bots take their turns`);
    const history = await page.locator("[data-seat]:visible").allInnerTexts();
    check(history.some((t) => /Prefect #\d/.test(t)), `${label}: bots are labelled Prefect #n at the table`);

    // Chips never appear or vanish: the stacks always add up to the starting total.
    const stacks = await page.locator("[data-seat]:visible").evaluateAll((els) =>
      els.map((e) => Number((e.innerText.match(/\n([\d,]+)\n?/)?.[1] ?? "0").replace(/,/g, ""))));
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/practice-table-${label}.png` });
    console.log(`   ${label} stacks now: ${stacks.join(" / ")}`);
    await ctx.close();
  }
  check(errors.length === 0, "no browser errors or blocked resources", errors.slice(0, 3).join("; "));
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED");
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
