// import playwright from any project that has it installed, e.g.:
//   import { chromium } from 'file:///path/to/your/project/node_modules/playwright/index.mjs';
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const BASE = 'https://www.example-group.com';
const OUT = '/tmp/eag-video/video';

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
    c.style.cssText = 'position:fixed;width:24px;height:24px;border-radius:50%;background:rgba(201,138,75,.9);border:2.5px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,.45);z-index:2147483647;pointer-events:none;transform:translate(-50%,-50%);transition:left .6s cubic-bezier(.4,0,.2,1),top .6s cubic-bezier(.4,0,.2,1);left:' + x + 'px;top:' + y + 'px';
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
      r.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:16px;height:16px;border-radius:50%;border:3px solid #c98a4b;z-index:2147483646;pointer-events:none;transform:translate(-50%,-50%);animation:vrip .55s ease-out forwards`;
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
    d.innerHTML = `<div style="position:fixed;left:56px;bottom:72px;z-index:999998;background:rgba(244,239,230,.97);border-left:6px solid #c98a4b;padding:20px 34px;box-shadow:0 12px 40px rgba(0,0,0,.22);transform:translateX(-40px);opacity:0;transition:all .5s cubic-bezier(.4,0,.2,1)">
      <div style="font-family:'DM Sans',sans-serif;font-size:12px;font-weight:600;letter-spacing:2.5px;color:#c98a4b;text-transform:uppercase;margin-bottom:6px">${kicker}</div>
      <div style="font-family:'Playfair Display',Georgia,serif;font-size:30px;color:#10141f">${title}</div></div>`;
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
      <div style="position:fixed;inset:0;background:rgba(16,20,31,.93);z-index:999999;display:flex;align-items:center;justify-content:center">
        <div style="text-align:center;max-width:760px;padding:40px">
          <div style="font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;letter-spacing:3px;color:#c98a4b;text-transform:uppercase;margin-bottom:14px">${kicker}</div>
          <div style="font-family:'Playfair Display',Georgia,serif;font-size:46px;color:#f4efe6;line-height:1.2">${title}</div>
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


/** Scroll a section heading into a pleasing position via eased drift. */
async function toSection(textSel, offset = 160) {
  try {
    const el = page.locator(textSel).first();
    const y = await el.evaluate(e => e.getBoundingClientRect().top + window.scrollY, null, { timeout: 8000 });
    await drift(Math.max(0, y - offset));
  } catch {
    // heading text not found — keep the film moving rather than dying mid-take
    await drift(await page.evaluate(() => window.scrollY + 800), 12);
  }
}



// ============ Open directly on the hero — the b-roll is the title ============
await nav(BASE + '/', { waitUntil: 'load' });
await pause(1500);
mark('hook');                                   // 8.0s — over hero, no card
await pause(5500);
await drift(350); await pause(3500);

mark('overview');                               // 8.1s
await drift(120, 10); await pause(4200);
await drift(600); await pause(4800);

mark('pillars');                                // 6.0s
await toSection('text=Our Pillars'); await pause(3200);
await drift(await page.evaluate(() => window.scrollY + 500), 12); await pause(3000);

mark('houses');                                 // 9.8s — the thesis beat, longest dwell
await toSection('text=Our businesses'); await pause(4200);
await drift(await page.evaluate(() => window.scrollY + 700), 10); await pause(6400);

mark('research');                               // 10.4s
await toSection('text=Research that compounds'); await pause(4800);
await drift(await page.evaluate(() => window.scrollY + 500), 12); await pause(6400);

mark('projects');                               // 5.7s
await toSection('text=From the field'); await pause(3400);
await drift(await page.evaluate(() => window.scrollY + 400), 14); await pause(3200);

mark('proof');                                  // 7.0s over a QUICK two-stop montage
await toSection('text=A network of partners', 220); await pause(2600);
await toSection('text=Scaled. Diversified.', 200); await pause(2400);
await drift(await page.evaluate(() => window.scrollY + 350), 16); await pause(2800);

// ============ Breath — music only, no narration ============
mark('breath');
await toSection('text=Insights'); await pause(4600);

// ============ Close on the investor room ============
mark('close');                                  // 7.5s
await strap('Capital', 'The investor room', 2600);
await nav(BASE + '/investor', { waitUntil: 'load' });
await pause(2400);
await drift(550, 10); await pause(2600);
await caption('Example Capital Group', 'The essentials, held for the long term.', 'example-group.com/investors', 6000);

await ctx.close();
await browser.close();
console.log('recording complete');
