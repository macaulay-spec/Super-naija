// Verify the DEPLOYED static site loads and is playable
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';

const CHROME = path.join(os.homedir(), '.cache/ms-playwright/chromium-1217/chrome-linux64/chrome');
const URL = process.env.URL || 'https://sites.super.myninja.ai/e00160f0-d671-4a51-aa6a-6892cd9e7253/8dde6ea8/index.html';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 412, height: 820 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForTimeout(3000);
  const entered = await page.getByText('ENTER IBADAN').count();
  await page.getByText('ENTER IBADAN').click();
  await page.waitForTimeout(800);
  await page.locator('#setup-name').fill('PublicTester');
  await page.getByText('START LIFE').click();
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => ({
    running: window.game?.running,
    conn: window.game?.net?.state,
    wallet: window.game?.profile?.wallet?.cash,
    colliders: window.game?.city?.colliders?.length,
    triangles: window.game?.renderer?.info?.render?.triangles,
    drawCalls: window.game?.renderer?.info?.render?.calls,
  }));
  await page.screenshot({ path: '/workspace/deployed_check.png' });
  console.log(JSON.stringify({ url: URL, enterBtn: entered, info, errors: errors.slice(0, 5) }, null, 2));
  await browser.close();
  process.exit(0);
})();
