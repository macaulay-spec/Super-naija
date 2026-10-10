import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';
const CHROME = path.join(os.homedir(), '.cache/ms-playwright/chromium-1217/chrome-linux64/chrome');

async function run(label, URL, tag) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true,
    args: ['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 820 } });
  const errors = [];
  page.on('console', m => { if (m.type()==='error') errors.push(m.text().slice(0,140)); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message.slice(0,140)));
  console.log(`\n======== ${label} ========`);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const s0 = await page.evaluate(() => ({
    enterVisible: !document.getElementById('enter-btn').classList.contains('hidden'),
    enterText: document.getElementById('enter-btn').textContent.trim(),
    status: document.getElementById('load-status').textContent,
    ready: window.game ? 'game exists' : 'no game',
  }));
  console.log('LOADING:', JSON.stringify(s0));
  await page.screenshot({ path: `shots/${tag}-1-loading.png` });

  // Click ENTER IBADAN
  await page.getByText('ENTER IBADAN').click().catch(e=>console.log('click err', e.message));
  await page.waitForTimeout(1500);
  const s1 = await page.evaluate(() => ({
    setupVisible: !document.getElementById('setup-screen').classList.contains('hidden'),
    hudVisible: !document.getElementById('hud').classList.contains('hidden'),
    running: window.game?.running,
    loadingVisible: !document.getElementById('loading-screen').classList.contains('hidden'),
  }));
  console.log('AFTER ENTER CLICK:', JSON.stringify(s1));
  await page.screenshot({ path: `shots/${tag}-2-after-enter.png` });

  // If setup shown, fill and start
  if (s1.setupVisible) {
    await page.locator('#setup-name').fill('Tester');
    await page.getByText('START LIFE').click().catch(e=>console.log('start err', e.message));
    await page.waitForTimeout(3000);
    const s2 = await page.evaluate(() => ({
      running: window.game?.running,
      hudVisible: !document.getElementById('hud').classList.contains('hidden'),
      hasProfile: !!window.game?.profile,
      fps: window.game?.fps,
    }));
    console.log('AFTER START LIFE:', JSON.stringify(s2));
    await page.screenshot({ path: `shots/${tag}-3-game.png` });
  }
  console.log('ERRORS:', JSON.stringify(errors.slice(0,6)));
  await browser.close();
}

await run('LOCAL (8090)', 'http://localhost:8090/', 'local');
await run('DEPLOYED (sites.super.myninja.ai)', 'https://sites.super.myninja.ai/e00160f0-d671-4a51-aa6a-6892cd9e7253/8dde6ea8/index.html', 'deployed');
process.exit(0);
