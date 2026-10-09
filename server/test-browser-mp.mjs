// Two REAL browser clients join the same session (acceptance test)
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';

const CHROME = path.join(os.homedir(), '.cache/ms-playwright/chromium-1217/chrome-linux64/chrome');
const URL = process.env.GAME_URL || 'http://localhost:8090/';

async function bootPlayer(name) {
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 412, height: 820 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.getByText('ENTER IBADAN').click();
  await page.waitForTimeout(800);
  await page.locator('#setup-name').fill(name);
  await page.getByText('START LIFE').click();
  await page.waitForTimeout(3500);
  const connText = await page.evaluate(() => document.body.innerText);
  return { browser, page, errors, connText };
}

const snap = (page) => page.evaluate(() => ({
  myId: window.game?.net?.myId,
  state: window.game?.net?.state,
  latency: window.game?.net?.latency,
  myPos: window.game?.player ? { x: +window.game.player.position.x.toFixed(2), z: +window.game.player.position.z.toFixed(2) } : null,
  remotes: [...(window.game?.remotePlayers?.entries() ?? [])].map(([id, rp]) => ({ id, x: +rp.position.x.toFixed(2), z: +rp.position.z.toFixed(2) })),
}));

(async () => {
  const A = await bootPlayer('Ade');
  const B = await bootPlayer('Ngozi');
  await A.page.waitForTimeout(2000);
  await B.page.waitForTimeout(2000);

  const aBefore = await snap(A.page);
  const bBefore = await snap(B.page);

  // A moves
  await A.page.keyboard.down('w');
  await A.page.waitForTimeout(1800);
  await A.page.keyboard.up('w');
  await B.page.waitForTimeout(1200);

  const aAfter = await snap(A.page);
  const bAfter = await snap(B.page);

  const aId = aBefore.myId;
  const bSawA = {
    before: bBefore.remotes.find((r) => r.id === aId) || null,
    after: bAfter.remotes.find((r) => r.id === aId) || null,
  };

  console.log(JSON.stringify({
    A: { online: /Online/.test(A.connText), myId: aBefore.myId, myPosBefore: aBefore.myPos, myPosAfter: aAfter.myPos, remoteIds: aBefore.remotes.map((r) => r.id), errors: A.errors.slice(0, 3) },
    B: { online: /Online/.test(B.connText), myId: bBefore.myId, remoteIds: bBefore.remotes.map((r) => r.id), errors: B.errors.slice(0, 3) },
    aMoved: JSON.stringify(aBefore.myPos) !== JSON.stringify(aAfter.myPos),
    bSawA,
    bSawAMove: bSawA.before && bSawA.after && (bSawA.before.x !== bSawA.after.x || bSawA.before.z !== bSawA.after.z),
  }, null, 2));

  await A.browser.close();
  await B.browser.close();
  process.exit(0);
})();
