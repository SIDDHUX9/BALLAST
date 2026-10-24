import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface SectionSpec {
  name: string;
  id: string;
  sliceTop: number;
  sliceHeight: number;
}

const SECTIONS: SectionSpec[] = [
  { name: '01-hero', id: 'hero', sliceTop: 0, sliceHeight: 270 },
  { name: '02-problem', id: 'problem', sliceTop: 270, sliceHeight: 170 },
  { name: '03-steps', id: 'how-it-works', sliceTop: 440, sliceHeight: 120 },
  { name: '04-simulator', id: 'simulator', sliceTop: 560, sliceHeight: 190 },
  { name: '05-belief', id: 'belief', sliceTop: 750, sliceHeight: 150 },
  { name: '06-footer', id: 'footer', sliceTop: 900, sliceHeight: 124 },
];

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const diffDir = path.resolve(rootDir, 'docs/landing-diff');
  const mockupPath = path.resolve(rootDir, 'design-reference/full-mockup.png');

  if (!fs.existsSync(diffDir)) {
    fs.mkdirSync(diffDir, { recursive: true });
  }

  console.log('🚀 Starting Landing Page Visual Verification with Playwright...');
  const browser = await chromium.launch({ headless: true });

  // 1. Desktop 1440 Viewport
  console.log('📸 Capturing 1440px viewport (Desktop)...');
  const desktopPage = await browser.newPage({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });

  await desktopPage.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await desktopPage.evaluate(() => {
    document.documentElement.classList.remove('dark');
  });
  await desktopPage.waitForTimeout(2000);

  // Full page screenshot
  const fullPageBuf = await desktopPage.screenshot({ fullPage: true });
  fs.writeFileSync(path.join(diffDir, 'localhost-1440-full.png'), fullPageBuf);

  // 2. Responsive Check: 390px (Mobile)
  console.log('📱 Capturing 390px viewport (Mobile iPhone 14)...');
  const mobilePage = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  await mobilePage.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await mobilePage.evaluate(() => {
    document.documentElement.classList.remove('dark');
  });
  await mobilePage.waitForTimeout(1500);
  const mobileBuf = await mobilePage.screenshot({ fullPage: true });
  fs.writeFileSync(path.join(diffDir, 'localhost-390-mobile.png'), mobileBuf);
  await mobilePage.close();

  // 3. Responsive Check: 768px (Tablet)
  console.log('📱 Capturing 768px viewport (Tablet iPad)...');
  const tabletPage = await browser.newPage({
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 1,
  });
  await tabletPage.goto('http://localhost:3000/', { waitUntil: 'networkidle' });
  await tabletPage.evaluate(() => {
    document.documentElement.classList.remove('dark');
  });
  await tabletPage.waitForTimeout(1500);
  const tabletBuf = await tabletPage.screenshot({ fullPage: true });
  fs.writeFileSync(path.join(diffDir, 'localhost-768-tablet.png'), tabletBuf);
  await tabletPage.close();

  // 4. Section by Section Visual Diff at 1440px
  console.log('\n🔍 Processing Per-Section Visual Comparison vs Target Reference:');
  const mockupSharp = sharp(mockupPath);

  const results: { section: string; matchPercent: string; diffPixels: number; totalPixels: number }[] = [];

  for (const sec of SECTIONS) {
    console.log(`\n--- Comparing Section: ${sec.name} ---`);

    // Capture render slice
    let renderedBuf: Buffer;
    if (sec.id === 'hero') {
      // Hero section includes header + section 1
      const headerBox = await desktopPage.locator('header').boundingBox();
      const heroBox = await desktopPage.locator('section').first().boundingBox();
      if (headerBox && heroBox) {
        renderedBuf = await desktopPage.screenshot({
          clip: {
            x: 0,
            y: 0,
            width: 1440,
            height: Math.round(headerBox.height + heroBox.height),
          },
        });
      } else {
        renderedBuf = await desktopPage.locator('section').first().screenshot();
      }
    } else if (sec.id === 'footer') {
      renderedBuf = await desktopPage.locator('footer').screenshot();
    } else {
      renderedBuf = await desktopPage.locator(`#${sec.id}`).screenshot();
    }

    const renderMeta = await sharp(renderedBuf).metadata();
    const renderWidth = renderMeta.width || 1440;
    const renderHeight = renderMeta.height || 600;

    // Crop target reference slice and scale to match rendered width & height
    const targetSliceBuf = await mockupSharp
      .clone()
      .extract({
        left: 0,
        top: sec.sliceTop,
        width: 352,
        height: sec.sliceHeight,
      })
      .resize(renderWidth, renderHeight, { fit: 'fill' })
      .toFormat('png')
      .toBuffer();

    // Decode PNGs for pixelmatch
    const img1 = PNG.sync.read(renderedBuf);
    const img2 = PNG.sync.read(targetSliceBuf);
    const { width, height } = img1;
    const diffPng = new PNG({ width, height });

    const diffPixels = pixelmatch(
      img1.data,
      img2.data,
      diffPng.data,
      width,
      height,
      { threshold: 0.18, includeAA: false }
    );

    const totalPixels = width * height;
    const matchPercent = (((totalPixels - diffPixels) / totalPixels) * 100).toFixed(2);

    results.push({
      section: sec.name,
      matchPercent: `${matchPercent}%`,
      diffPixels,
      totalPixels,
    });

    console.log(`Score for ${sec.name}: ${matchPercent}% match (${diffPixels} diff px / ${totalPixels} total)`);

    // Save Section Render, Target Slice, and Diff Overlay
    fs.writeFileSync(path.join(diffDir, `${sec.name}-render.png`), renderedBuf);
    fs.writeFileSync(path.join(diffDir, `${sec.name}-target.png`), targetSliceBuf);
    fs.writeFileSync(path.join(diffDir, `${sec.name}-diff-overlay.png`), PNG.sync.write(diffPng));

    // Create Side-by-Side Comparison [Target Reference | Rendered Localhost]
    const sideBySide = await sharp({
      create: {
        width: width * 2,
        height: height,
        channels: 4,
        background: { r: 247, g: 239, b: 228, alpha: 1 },
      },
    })
      .composite([
        { input: targetSliceBuf, left: 0, top: 0 },
        { input: renderedBuf, left: width, top: 0 },
      ])
      .png()
      .toBuffer();

    fs.writeFileSync(path.join(diffDir, `${sec.name}-side-by-side.png`), sideBySide);
  }

  await browser.close();

  // Print Summary Table
  console.log('\n======================================================');
  console.log('🏁 LANDING PAGE VISUAL DIFF VERIFICATION RESULTS');
  console.log('======================================================');
  console.table(results);
  console.log(`\nOutputs and overlays saved to: ${diffDir}`);
}

main().catch((err) => {
  console.error('Fatal error during visual diff:', err);
  process.exit(1);
});
