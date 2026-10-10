// Reproduce the "can't enter game" bug across scenarios
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';

const CHROME = path.join(os.homedir(), '.cache/ms-playwright/chromium-1217/chrome-linux64/chrome');
const URL = process.env.GAME_URL || 'http://localhost:8090/';

async function scenario(name, fn) {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 412, height: 820 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
  try {
    const out = await fn(page);
    console.log(`\n### ${name}\n` + JSON.stringify({ ...out, errors: errors.slice(0, 4) }, null, 2));
  } catch (e) {
    console.log(`\n### ${name}\nFAILED: ${e.message}\n errors: ${JSON.stringify(errors.slice(0, 4))}`);
  }
  await browser.close();
}

(async () => {
  // Scenario 1: fresh load, wait for ready, press KEYBOARD Enter
  await scenario('1. Keyboard Enter (fresh)', async (page) => {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const before = await page.evaluate(() => ({
      enterVisible: !document.getElementById('enter-btn').classList.contains('hidden'),
      status: document.getElementById('load-status').textContent,
      running: window.game?.running,
    }));
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    const after = await page.evaluate(() => ({
      running: window.game?.running,
      setupVisible: !document.getElementById('setup-screen').classList.contains('hidden'),
      hudVisible: !document.getElementById('hud').classList.contains('hidden'),
    }));
    return { before, after };
  });

  // Scenario 2: fresh load, CLICK the button
  await scenario('2. Click button (fresh)', async (page) => {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    const vis = await page.evaluate(() => !document.getElementById('enter-btn').classList.contains('hidden'));
    if (vis) await page.getByText('ENTER IBADAN').click();
    await page.waitForTimeout(1500);
    return await page.evaluate(() => ({
      buttonWasVisible: true,
      setupVisible: !document.getElementById('setup-screen').classList.contains('hidden'),
      hudVisible: !document.getElementById('hud').classList.contains('hidden'),
      running: window.game?.running,
    }));
  });

  // Scenario 3: existing profile -> click -> should start game
  await scenario('3. Click button (existing save)', async (page) => {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.getByText('ENTER IBADAN').click();
    await page.waitForTimeout(600);
    await page.locator('#setup-name').fill('Returning');
    await page.getByText('START LIFE').click();
    await page.waitForTimeout(3000);
    // reload to simulate returning player
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.getByText('ENTER IBADAN').click();
    await page.waitForTimeout(1500);
    return await page.evaluate(() => ({
      running: window.game?.running,
      hudVisible: !document.getElementById('hud').classList.contains('hidden'),
      hasProfile: !!window.game?.profile,
    }));
  });

  // Scenario 4: corrupted save
  await scenario('4. Corrupted save', async (page) => {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.setItem('ibadan_profile', '{"id":"x","position":null}'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.getByText('ENTER IBADAN').click();
    await page.waitForTimeout(1500);
    return await page.evaluate(() => ({
      running: window.game?.running,
      setupVisible: !document.getElementById('setup-screen').classList.contains('hidden'),
      hudVisible: !document.getElementById('hud').classList.contains('hidden'),
    }));
  });

  // Scenario 5: FULL keyboard-only flow (fresh): Enter -> setup -> Enter -> running
  await scenario('5. Keyboard-only full flow (fresh)', async (page) => {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.keyboard.press('Enter');           // enter from loading screen
    await page.waitForTimeout(800);
    const afterEnter = await page.evaluate(() => ({
      setupVisible: !document.getElementById('setup-screen').classList.contains('hidden'),
      running: window.game?.running,
    }));
    await page.locator('#setup-name').fill('KeyboardKid');
    await page.keyboard.press('Enter');           // submit from setup screen
    await page.waitForTimeout(2500);
    const afterSubmit = await page.evaluate(() => ({
      running: window.game?.running,
      hudVisible: !document.getElementById('hud').classList.contains('hidden'),
      hasProfile: !!window.game?.profile,
      name: window.game?.profile?.name,
    }));
    return { afterEnter, afterSubmit };
  });

  // Scenario 6: existing save -> keyboard Enter -> running directly
  await scenario('6. Keyboard Enter (existing save)', async (page) => {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await page.getByText('ENTER IBADAN').click();
    await page.waitForTimeout(600);
    await page.locator('#setup-name').fill('Returning');
    await page.getByText('START LIFE').click();
    await page.waitForTimeout(2500);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await page.keyboard.press('Enter');           // keyboard enter with a save present
    await page.waitForTimeout(1500);
    return await page.evaluate(() => ({
      running: window.game?.running,
      hudVisible: !document.getElementById('hud').classList.contains('hidden'),
      hasProfile: !!window.game?.profile,
    }));
  });

  process.exit(0);
})();
