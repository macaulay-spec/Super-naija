// Capture a screenshot proving two real players share the world
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';

const CHROME = path.join(os.homedir(), '.cache/ms-playwright/chromium-1217/chrome-linux64/chrome');
const URL = process.env.GAME_URL || 'https://vision-basket-wisconsin-attractions.trycloudflare.com/';

async function boot(name, tag) {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 412, height: 820 } });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.getByText('ENTER IBADAN').click();
  await page.waitForTimeout(700);
  await page.locator('#setup-name').fill(name);
  await page.getByText('START LIFE').click();
  await page.waitForTimeout(4000);
  return { browser, page, tag };
}

(async () => {
  const A = await boot('Ade', 'A');
  const B = await boot('Ngozi', 'B');
  await A.page.waitForTimeout(2000);
  // Move A sideways so both avatars are visible
  await A.page.keyboard.down('d');
  await A.page.waitForTimeout(1400);
  await A.page.keyboard.up('d');
  await A.page.waitForTimeout(1500);
  // B looks toward A and screenshots
  await B.page.evaluate(() => {
    const rp = [...window.game.remotePlayers.values()][0];
    if (rp) { window.game.player.yaw = Math.atan2(rp.position.x - window.game.player.position.x, rp.position.z - window.game.player.position.z); }
  });
  await B.page.waitForTimeout(1200);
  await B.page.screenshot({ path: '/workspace/multiplayer_proof.png' });
  const state = await B.page.evaluate(() => ({
    myId: window.game.net.myId,
    conn: window.game.net.state,
    remotes: [...window.game.remotePlayers.values()].map((r) => ({ x: +r.position.x.toFixed(1), z: +r.position.z.toFixed(1) })),
  }));
  console.log(JSON.stringify(state, null, 2));
  await A.browser.close();
  await B.browser.close();
  process.exit(0);
})();
