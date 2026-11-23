/**
 * Two guests (no accounts) play together from an invitation link, at iPad
 * screen sizes. Creates throwaway guests named zagtest_*.
 *
 *   BASE_URL=http://localhost:3000 node tests/e2e/guest-invite.e2e.cjs
 */
const { chromium } = require("playwright");
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const proxied = !!process.env.BROWSER_PROXY;
const id = Math.random().toString(36).slice(2, 8);
let failed = 0;
const csp = [];
const check = (ok, l, x = "") => { if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"} - ${l}${x ? ` (${x})` : ""}`); };
(async () => {
  const b = await chromium.launch(proxied ? { proxy: { server: process.env.BROWSER_PROXY, bypass: "localhost,127.0.0.1" } } : {});
  const mk = async (vp) => { const c = await b.newContext({ viewport: vp, ignoreHTTPSErrors: proxied }); const p = await c.newPage(); p.on("console", (m) => { if (/Content Security Policy/i.test(m.text())) csp.push(m.text()); }); return p; };
  const host = await mk({ width: 1180, height: 820 });   // iPad landscape
  const friend = await mk({ width: 820, height: 1180 }); // iPad portrait
  // Host: guest, creates a private table.
  await host.goto(`${BASE}/`); await host.click('main a:has-text("Play now")');
  await host.fill("[name=username]", `zagtest_${id}h`); await host.click("main button[type=submit]");
  await host.waitForURL("**/lobby", { timeout: 20000 });
  check(true, "host enters as a guest with only a name");
  await host.getByRole("button", { name: "Create table" }).click();
  await host.fill("[name=name]", `Guests ${id}`);
  await host.locator("select").nth(2).selectOption("20");
  await host.getByRole("button", { name: /Create and sit down/ }).click();
  await host.waitForURL("**/table/*", { timeout: 30000 });
  const code = ((await host.getByTitle("Copy room code").textContent()) ?? "").trim();
  check(/^[A-Z2-9]{8}$/.test(code), "guest host creates a private table", code);
  // Friend: no session, opens the invitation link.
  await friend.goto(`${BASE}/join/${code}`);
  await friend.waitForURL("**/play?next=*");
  check(true, "an invitation link without a session asks only for a name");
  await friend.fill("[name=username]", `zagtest_${id}f`); await friend.click("main button[type=submit]");
  await friend.getByText("You have been invited to a private table").waitFor({ timeout: 20000 });
  check(true, "after entering a name the friend lands back on the invitation");
  await friend.getByRole("button", { name: /Take a seat/ }).click();
  await friend.waitForURL("**/table/*");
  await host.locator("[data-seat]:visible", { hasText: `zagtest_${id}f` }).waitFor({ timeout: 15000 });
  check(true, "the host sees the friend sit down live");
  await host.getByRole("button", { name: "Start game" }).click();
  const own = (p) => p.locator("[data-seat]:visible [role=img]:not([aria-label='Face-down card'])");
  await Promise.all([own(host).nth(1).waitFor({ timeout: 20000 }), own(friend).nth(1).waitFor({ timeout: 20000 })]);
  check(true, "both guests are dealt their cards");
  for (const p of [host, friend]) check(!(await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)), "no sideways scrolling on an iPad-sized screen");
  if (process.env.SCREENSHOT_DIR) {
    await host.screenshot({ path: `${process.env.SCREENSHOT_DIR}/ipad-landscape.png` });
    await friend.screenshot({ path: `${process.env.SCREENSHOT_DIR}/ipad-portrait.png` });
  }
  // The host closes the table: the hand is cancelled and both are cashed out.
  await host.locator("button[aria-label='Delete table']:visible").click();
  await host.getByRole("dialog").getByRole("button", { name: "Delete table" }).click();
  await host.waitForURL("**/lobby", { timeout: 20000 });
  check(csp.length === 0, "the Content Security Policy blocked nothing the site needs");
  console.log(failed ? `\n${failed} CHECK(S) FAILED` : "\nALL CHECKS PASSED", `(zagtest_${id}h, zagtest_${id}f)`);
  await b.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(String(e).slice(0, 400)); process.exit(1); });
