import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('📱 Starting Responsive & Layout Overflow Verification...');
  const widths = [320, 375, 390, 768, 1024, 1440, 1920];
  const outDir = path.resolve(__dirname, '../docs/screenshots');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  let hasFailure = false;

  for (const width of widths) {
    console.log(`\nTesting viewport width: ${width}px...`);
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      deviceScaleFactor: 1,
    });

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(1000);

    // 1. Check for horizontal overflow
    const overflowInfo = await page.evaluate(() => {
      const docWidth = document.documentElement.scrollWidth;
      const winWidth = window.innerWidth;
      const bodyWidth = document.body.scrollWidth;
      return {
        hasHorizontalScroll: docWidth > winWidth + 1,
        docWidth,
        winWidth,
        bodyWidth,
      };
    });

    console.log(`  Scroll check: docWidth=${overflowInfo.docWidth}px, winWidth=${overflowInfo.winWidth}px`);
    if (overflowInfo.hasHorizontalScroll) {
      console.error(`  ❌ FAIL: Horizontal scroll detected at ${width}px!`);
      hasFailure = true;
    } else {
      console.log(`  ✅ PASS: No horizontal scroll.`);
    }

    // 2. Check headings visibility and bounding boxes
    const headings = await page.$$eval('h1, h2, h3', (elements) =>
      elements.map((el) => ({
        tag: el.tagName,
        text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40),
        rect: el.getBoundingClientRect(),
        visible: el.offsetParent !== null && window.getComputedStyle(el).visibility !== 'hidden',
      }))
    );

    console.log(`  Found ${headings.length} headings. All visible: ${headings.every((h) => h.visible)}`);

    // 3. Capture screenshot
    const shotPath = path.join(outDir, `viewport-${width}.png`);
    await page.screenshot({ path: shotPath, fullPage: true });
    console.log(`  Saved screenshot: ${shotPath}`);

    await page.close();
  }

  await browser.close();

  if (hasFailure) {
    console.error('\n❌ Responsive verification failed!');
    process.exit(1);
  } else {
    console.log('\n✅ ALL 7 VIEWPORTS (320, 375, 390, 768, 1024, 1440, 1920) PASSED: Zero horizontal overflow!');
  }
}

main().catch((err) => {
  console.error('Fatal error during responsive verification:', err);
  process.exit(1);
});
