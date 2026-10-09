// Comprehensive gameplay systems test in a REAL browser
import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';

const CHROME = path.join(os.homedir(), '.cache/ms-playwright/chromium-1217/chrome-linux64/chrome');
const URL = process.env.GAME_URL || 'http://localhost:8090/';

(async () => {
  const browser = await chromium.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
  });
  const page = await browser.newPage({ viewport: { width: 412, height: 820 } });
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.getByText('ENTER IBADAN').click();
  await page.waitForTimeout(600);
  await page.locator('#setup-name').fill('Tester');
  await page.getByText('START LIFE').click();
  await page.waitForTimeout(3500);

  const results = await page.evaluate(() => {
    const g = window.game;
    const out = {};
    const inv = (id) => g.profile.inventory.find((i) => i.id === id)?.qty || 0;

    // fund the tester
    g.profile.wallet.cash = 10_000_000;
    g.profile.wallet.bank = 0;

    // 1. Buy item
    const cash0 = g.profile.wallet.cash;
    g.buyItem('jollof');
    out.buyItem = { cashDelta: cash0 - g.profile.wallet.cash, jollofQty: inv('jollof') };

    // 2. Use item (eat)
    const hunger0 = g.profile.needs.hunger;
    g.useItem('jollof');
    out.useItem = { hungerDelta: g.profile.needs.hunger - hunger0 };

    // 3. Apply for job
    g.applyForJob('shopkeeper');
    out.applyJob = { jobId: g.profile.jobId };

    // 4. Buy property
    const propsBefore = g.profile.ownedPropertyIds.length;
    g.buyProperty('apt_mokola');
    out.buyProperty = { owned: g.profile.ownedPropertyIds.length - propsBefore, hasMokola: g.profile.ownedPropertyIds.includes('apt_mokola') };

    // 5. Buy vehicle
    const vehBefore = g.profile.ownedVehicleIds.length;
    const sceneVehBefore = g.vehicles.length;
    g.buyVehicle('keke');
    out.buyVehicle = { owned: g.profile.ownedVehicleIds.length - vehBefore, spawned: g.vehicles.length - sceneVehBefore };

    // 6. Enter / exit interior
    g.enterInterior('shop', 'Test Shop');
    const inShop = g.inInterior && g.currentInterior === 'shop';
    g.exitInterior();
    out.interior = { entered: inShop, exited: !g.inInterior };

    // 7. Enter vehicle + drive physics
    const v = g.vehicles[0];
    g.enterVehicle(v);
    const enteredVeh = g.currentVehicle === v && g.player.inVehicle === true;
    for (let i = 0; i < 30; i++) v.update(0.05, { throttle: 1, steer: 0, brake: false }, g.activeColliders);
    const kmh = v.getSpeedKmh();
    g.exitVehicle();
    out.vehicle = { entered: enteredVeh, speedKmh: +kmh.toFixed(1), exited: g.currentVehicle === null };

    // 8. Bank deposit / withdraw
    g.profile.wallet.cash = 100000; g.profile.wallet.bank = 0;
    g.bankDeposit(5000);
    const afterDep = g.profile.wallet.bank;
    g.bankWithdraw(1000);
    out.bank = { afterDeposit: afterDep, afterWithdraw: g.profile.wallet.bank };

    // 9. XP / level up
    const lvl0 = g.profile.stats.level;
    g.addXP(500);
    out.level = { before: lvl0, after: g.profile.stats.level };

    // 10. Business purchase
    g.profile.wallet.cash = 10_000_000;
    const bizBefore = g.ownedBusinesses.length;
    g.buyBusiness('biz_restaurant');
    out.business = { owned: g.ownedBusinesses.length - bizBefore, list: g.ownedBusinesses.slice() };

    // 11. Sell item
    g.buyItem('suya');
    const cashB = g.profile.wallet.cash;
    g.sellItem('suya');
    out.sellItem = { cashGained: g.profile.wallet.cash - cashB };

    // World stats
    out.world = {
      colliders: g.city.colliders.length,
      interactables: g.city.interactables.length,
      footprints: g.city.footprints.length,
      vehicles: g.vehicles.length,
      npcs: g.npcs ? (g.npcs.pedestrians.length + g.npcs.traffic.length) : 'n/a',
      pedestrians: g.npcs ? g.npcs.pedestrians.length : 'n/a',
      traffic: g.npcs ? g.npcs.traffic.length : 'n/a',
      interiors: g.interiors.size,
    };
    return out;
  });

  console.log(JSON.stringify({ results, errors: errors.slice(0, 5) }, null, 2));
  await browser.close();
  process.exit(0);
})();
