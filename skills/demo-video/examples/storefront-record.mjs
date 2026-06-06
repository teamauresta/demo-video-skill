// import playwright from any project that has it installed, e.g.:
//   import { chromium } from 'file:///path/to/your/project/node_modules/playwright/index.mjs';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = 'https://shop.example.com';
const OUT = '/tmp/demo-video/video';

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36',
});
const page = await ctx.newPage();

// ---- virtual cursor (headless capture has no mouse) ----
await page.addInitScript(() => {
  window.__mkCursor = (x = 960, y = 540) => {
    if (document.getElementById('vcur')) return;
    const st = document.createElement('style');
    st.textContent = '@keyframes vrip{to{width:70px;height:70px;opacity:0}}';
    document.head.appendChild(st);
    const c = document.createElement('div');
    c.id = 'vcur';
    c.style.cssText = 'position:fixed;width:24px;height:24px;border-radius:50%;background:rgba(0,48,135,.8);border:2.5px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,.45);z-index:2147483647;pointer-events:none;transform:translate(-50%,-50%);transition:left .6s cubic-bezier(.4,0,.2,1),top .6s cubic-bezier(.4,0,.2,1);left:' + x + 'px;top:' + y + 'px';
    document.body.appendChild(c);
  };
});
let curPos = { x: 960, y: 540 };
const ensureCursor = () => page.evaluate((p) => window.__mkCursor(p.x, p.y), curPos).catch(() => {});
async function glideClick(locator) {
  await ensureCursor();
  const box = await locator.boundingBox();
  if (box) {
    const x = box.x + box.width / 2, y = box.y + Math.min(box.height / 2, 42);
    curPos = { x, y };
    await page.evaluate(({ x, y }) => {
      const c = document.getElementById('vcur');
      if (c) { c.style.left = x + 'px'; c.style.top = y + 'px'; }
    }, curPos);
    await pause(750);
    await page.evaluate(({ x, y }) => {
      const r = document.createElement('div');
      r.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:16px;height:16px;border-radius:50%;border:3px solid #003087;z-index:2147483646;pointer-events:none;transform:translate(-50%,-50%);animation:vrip .55s ease-out forwards`;
      document.body.appendChild(r);
      setTimeout(() => r.remove(), 650);
    }, curPos);
    await pause(250);
  }
  await locator.click();
}
const nav = async (url, opts = { waitUntil: 'domcontentloaded' }) => { await page.goto(url, opts); await pause(400); await ensureCursor(); };

/** Lower-third strap for mid-video beats (full-screen cards stay for bookends). */
async function strap(kicker, title, ms = 3200) {
  await page.evaluate(({ kicker, title }) => {
    const d = document.createElement('div');
    d.id = 'demo-strap';
    d.innerHTML = `<div style="position:fixed;left:56px;bottom:72px;z-index:999998;background:rgba(255,255,255,.97);border-left:6px solid #003087;padding:20px 34px;box-shadow:0 12px 40px rgba(0,0,0,.22);transform:translateX(-40px);opacity:0;transition:all .5s cubic-bezier(.4,0,.2,1)">
      <div style="font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;letter-spacing:2.5px;color:#92702a;text-transform:uppercase;margin-bottom:6px">${kicker}</div>
      <div style="font-family:Marcellus,serif;font-size:30px;color:#222">${title}</div></div>`;
    document.body.appendChild(d);
    requestAnimationFrame(() => { const el = d.firstElementChild; el.style.transform = 'translateX(0)'; el.style.opacity = '1'; });
  }, { kicker, title });
  await pause(ms);
  await page.evaluate(() => {
    const d = document.getElementById('demo-strap');
    if (d) { const el = d.firstElementChild; el.style.opacity = '0'; el.style.transform = 'translateX(-40px)'; setTimeout(() => d.remove(), 500); }
  });
}
const pause = (ms) => page.waitForTimeout(ms);
const T0 = Date.now();
const mark = (n) => console.log(`MARK ${((Date.now() - T0) / 1000).toFixed(1)} ${n}`);

/** Branded caption card overlaid on the page, recorded into the video. */
async function caption(kicker, title, sub = '', ms = 3200) {
  await page.evaluate(({ kicker, title, sub }) => {
    const d = document.createElement('div');
    d.id = 'demo-caption';
    d.innerHTML = `
      <div style="position:fixed;inset:0;background:rgba(28,24,22,.88);z-index:999999;display:flex;align-items:center;justify-content:center">
        <div style="text-align:center;max-width:760px;padding:40px">
          <div style="font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;letter-spacing:3px;color:#c8a44d;text-transform:uppercase;margin-bottom:14px">${kicker}</div>
          <div style="font-family:Marcellus,serif;font-size:44px;color:#fff;line-height:1.2">${title}</div>
          ${sub ? `<div style="font-family:'DM Sans',sans-serif;font-size:17px;color:rgba(255,255,255,.75);margin-top:16px;line-height:1.6">${sub}</div>` : ''}
        </div>
      </div>`;
    document.body.appendChild(d);
  }, { kicker, title, sub });
  await pause(ms);
  await page.evaluate(() => document.getElementById('demo-caption')?.remove());
}

/** Cinematic scroll. */
async function drift(toY, step = 14) {
  await page.evaluate(async ({ toY, step }) => {
    const from = window.scrollY;
    const dir = toY > from ? 1 : -1;
    for (let y = from; dir > 0 ? y < toY : y > toY; y += dir * step) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 8));
    }
    window.scrollTo(0, toY);
  }, { toY, step });
}

async function type(sel, text) {
  await page.click(sel);
  await page.fill(sel, '');
  await page.type(sel, text, { delay: 55 });
}

// ============ Title card ============
await page.goto(BASE, { waitUntil: 'networkidle' });
const gate = page.locator('.age-gate__submit--yes, button:has-text("Yes")').first();
mark('title');
await caption('Acme Cellars · The Wine Shop', 'Client Demonstration', 'WooCommerce storefront · Card payments · Wine Club loyalty · Live freight quotes', 5900);
if (await gate.count()) { await pause(800); await glideClick(gate); await pause(1500); }

// ============ Act 1 — storefront ============
mark('storefront');
await strap('Act 1', 'The Storefront', 3000);
await pause(1500);
await drift(700); await pause(1200);   // story
await drift(1500); await pause(1200);  // categories
await drift(2400); await pause(1200);  // services
await drift(3300); await pause(1400);  // trending grid
await drift(0, 26); await pause(800);
await glideClick(page.locator('nav a:has-text("Red Wine")').first()); await pause(2200);
await drift(500); await pause(1200);
mark('product');
await glideClick(page.locator('a:has-text("Estate Shiraz 2023")').first()); await pause(2400);
await drift(420); await pause(2400);   // member hint under price

// ============ Act 2 — checkout & payment ============
mark('act2');
await strap('Act 2', 'Checkout & Payments', 3400);
await glideClick(page.locator('button[name="add-to-cart"], .single_add_to_cart_button').first()); await pause(2000);
await nav(`${BASE}/cart/`, { waitUntil: 'domcontentloaded' }); await pause(1500);
const calc = page.locator('a.shipping-calculator-button');
if (await calc.count()) {
  await glideClick(calc); await pause(900);
  await page.selectOption('#calc_shipping_state', 'NSW').catch(() => {});
  await type('#calc_shipping_city', 'Sydney');
  await type('#calc_shipping_postcode', '2000');
  await glideClick(page.locator('button[name="calc_shipping"]'));
  await pause(3000); // quotes (lane pre-warmed before recording)
  mark('couriers');
  await drift(450); await pause(2600); // admire the courier list
}
await nav(`${BASE}/checkout/`, { waitUntil: 'domcontentloaded' }); await pause(1800);
// human-paced on the personal fields…
mark('checkout');
await type('#billing_first_name', 'Caroline'); await type('#billing_last_name', 'Chisholm');
await type('#billing_email', 'caroline.chisholm@example.com');
// …but batch the recalc-triggering address fields so the order review
// refreshes ONCE (each blur re-quotes freight = spinner churn on video)
await page.fill('#billing_address_1', '123 Example Street');
await page.fill('#billing_city', 'Sydney');
await page.selectOption('#billing_state', 'NSW').catch(() => {});
await page.fill('#billing_phone', '0255501234');
await page.fill('#billing_postcode', '2000'); // same lane as the calculator — already warm
await page.locator('#billing_postcode').blur();
await pause(3500); // single quick recalc on the warm lane
await drift(900); await pause(2000);   // order review + payment method
mark('payment');
await glideClick(page.locator('#place_order')); await page.waitForURL('**/pay/**', { timeout: 60000 }); await pause(2600);
await glideClick(page.locator('button[value="success"]'));
await page.waitForURL('**order-received**', { timeout: 60000 }); await pause(1200);
mark('confirmed');
await drift(500); await pause(2400);   // order confirmed

// ============ Act 3 — loyalty ============
mark('act3');
await strap('Act 3', 'The Wine Club — meet James Busby', 3800);
await nav(`${BASE}/my-account/`, { waitUntil: 'domcontentloaded' }); await pause(1200);
await type('#username', 'demo.user'); await type('#password', process.env.DEMO_PASS || 'demo-password');
await glideClick(page.locator('button[name="login"]')); await pause(2600);
await nav(`${BASE}/shop/`, { waitUntil: 'domcontentloaded' }); await pause(1000);
mark('prices');
await drift(600); await pause(2600);   // 25%-off prices storewide
await nav(`${BASE}/my-account/club/`, { waitUntil: 'domcontentloaded' }); await pause(1400);
mark('dashboard');
await drift(400); await pause(4200);   // gold tier dashboard
mark('shipments');
await nav(`${BASE}/my-account/club-shipment/`, { waitUntil: 'domcontentloaded' }); await pause(2600);
await drift(500); await pause(2000);   // skip/swap controls
mark('pass');
await nav(`${BASE}/my-account/cellar-pass/`, { waitUntil: 'networkidle' }); await pause(3000); // QR
const staffUrl = readFileSync('/tmp/wine-photos/.verify-url', 'utf8').trim();
await strap('Cellar door', 'Staff scan the QR…', 3200);
mark('staff');
await nav(staffUrl, { waitUntil: 'networkidle' }); await pause(3600); // staff view
await page.goBack({ waitUntil: 'domcontentloaded' });
mark('experience');
await nav(`${BASE}/product/barrel-hall-tasting/`, { waitUntil: 'domcontentloaded' }); await pause(1200);
await drift(500); await pause(3700);   // redeem with points button

// ============ Close ============
mark('close');
await caption('Acme Cellars · The Wine Shop', 'Built on your rails.', 'Card payments · Live freight · A loyalty engine your members keep', 4500);

await ctx.close(); // flushes the video
await browser.close();
console.log('recording complete');
