import { chromium } from 'playwright';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const url = process.env.LOCAL_ONE_WEB_URL || 'http://127.0.0.1:5173/';
const desktopShot = path.join(root, 'local-one-desktop.png');
const mobileShot = path.join(root, 'local-one-mobile.png');

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});

const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') {
    errors.push(message.text());
  }
});
page.on('pageerror', (error) => errors.push(error.message));

await page.goto(url, { waitUntil: 'networkidle' });
await page.screenshot({ path: desktopShot, fullPage: true });

const title = await page.locator('h1').first().textContent();
const sendVisible = await page.getByRole('button', { name: /^送信$/ }).isVisible().catch(() => false);
const pairVisible = await page.getByRole('button', { name: /ペアリング/ }).first().isVisible().catch(() => false);
const queueText = await page.locator('.queue-panel').textContent().catch(() => '');

await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: mobileShot, fullPage: true });
await browser.close();

const result = {
  url,
  title,
  sendVisible,
  pairVisible,
  queueHasTransferQueue: queueText.includes('転送キュー'),
  errors,
  screenshots: {
    desktop: desktopShot,
    mobile: mobileShot,
  },
};

if (!result.title || !result.queueHasTransferQueue || !result.sendVisible || result.errors.length) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(result, null, 2));
