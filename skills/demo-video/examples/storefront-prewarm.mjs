// import playwright from any project that has it installed, e.g.:
//   import { chromium } from 'file:///path/to/your/project/node_modules/playwright/index.mjs';
import { chromium } from 'playwright';
const BASE = 'https://shop.example.com';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/cart/?add-to-cart=11`, { waitUntil: 'domcontentloaded' });
const gate = page.locator('.age-gate__submit--yes, button:has-text("Yes")').first();
if (await gate.count()) { await gate.click(); await page.waitForTimeout(1200); }
await page.goto(`${BASE}/cart/`, { waitUntil: 'domcontentloaded' });
const t = page.locator('a.shipping-calculator-button');
if (await t.count()) {
  await t.click(); await page.waitForTimeout(700);
  await page.selectOption('#calc_shipping_state', 'NSW').catch(() => {});
  await page.fill('#calc_shipping_city', 'Sydney');
  await page.fill('#calc_shipping_postcode', '2000');
  await page.click('button[name="calc_shipping"]');
  await page.waitForTimeout(9000);
}
const quotes = await page.locator('.shipping').innerText().catch(() => '');
console.log('lane warmed:', quotes.includes('Aramex') ? 'quotes cached ✓' : 'check manually');
await browser.close();
