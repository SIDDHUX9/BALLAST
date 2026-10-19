/* global document */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';

const SCREENSHOT_DIR = path.resolve('docs/screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const WIDTHS = [360, 768, 1280, 1536];
const THEMES = ['light', 'dark'];

async function run() {
  console.log('=== Capturing Ballast Responsive & Themed Screenshots ===\n');

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  for (const width of WIDTHS) {
    for (const theme of THEMES) {
      const page = await browser.newPage({
        viewport: { width, height: 900 },
      });

      console.log(`[CAPTURE] Rendering Landing Page at ${width}px (${theme} theme)...`);
      await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

      // Apply theme
      await page.evaluate((t) => {
        if (t === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }, theme);

      await page.waitForTimeout(300);

      const filename = `landing-${width}-${theme}.png`;
      const filePath = path.join(SCREENSHOT_DIR, filename);

      await page.screenshot({
        path: filePath,
        fullPage: true,
      });

      console.log(`[SAVED] -> ${filePath}`);
      await page.close();
    }
  }

  // Also capture design catalog
  for (const theme of THEMES) {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 900 },
    });

    console.log(`[CAPTURE] Rendering Design Catalog at 1280px (${theme} theme)...`);
    await page.goto('http://localhost:3000/design', { waitUntil: 'networkidle' });

    await page.evaluate((t) => {
      if (t === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }, theme);

    await page.waitForTimeout(300);

    const filename = `design-1280-${theme}.png`;
    const filePath = path.join(SCREENSHOT_DIR, filename);

    await page.screenshot({
      path: filePath,
      fullPage: true,
    });

    console.log(`[SAVED] -> ${filePath}`);
    await page.close();
  }

  await browser.close();
  console.log('\n=== All screenshots successfully captured! ===');
}

run().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
