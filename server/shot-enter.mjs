import { chromium } from 'playwright-core';
import os from 'node:os';
import path from 'node:path';
const CHROME = path.join(os.homedir(), '.cache/ms-playwright/chromium-1217/chrome-linux64/chrome');
const URL = process.env.GAME_URL || 'http://localhost:8090/';
const browser = await chromium.launch({ executablePath: CHROME, headless: true,
  args: ['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 412, height: 820 } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4500);
await page.screenshot({ path: 'shots/loading-enter.png' });
console.log('loading screenshot saved');
await browser.close();
