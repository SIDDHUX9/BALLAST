const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

async function main() {
  const targetDir = path.resolve(__dirname, '../apps/web/public/assets/landing');
  const sourcesDir = path.resolve(__dirname, '../design-reference/sources');
  const refDir = path.resolve(__dirname, '../design-reference');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  console.log('1. Processing hero-david.webp...');
  await sharp(path.join(sourcesDir, 'hero-david.jpg'))
    .webp({ quality: 90 })
    .toFile(path.join(targetDir, 'hero-david.webp'));

  console.log('2. Processing pointing-arm.webp...');
  await sharp(path.join(sourcesDir, 'pointing-arm.png'))
    .webp({ quality: 95, effort: 6 })
    .toFile(path.join(targetDir, 'pointing-arm.webp'));

  console.log('3. Processing simulator-colosseum.webp...');
  await sharp(path.join(sourcesDir, 'terracotta-colosseum.jpg'))
    .webp({ quality: 90 })
    .toFile(path.join(targetDir, 'simulator-colosseum.webp'));

  console.log('4. Processing belief-david.webp...');
  await sharp(path.join(sourcesDir, 'belief-david-cutout.png'))
    .webp({ quality: 95, effort: 6 })
    .toFile(path.join(targetDir, 'belief-david.webp'));

  console.log('5. Processing belief-facade.webp...');
  await sharp(path.join(sourcesDir, 'belief-facade.jpg'))
    .webp({ quality: 90 })
    .toFile(path.join(targetDir, 'belief-facade.webp'));

  console.log('6. Processing problem-arch-duomo.webp with clean text area and transparent arch outside...');
  // We take test-arch-cleaned.png (which is 576x498), patch out the baked text in top-right paper
  const archImg = sharp(path.join(assetsDir, 'test-arch-cleaned.png'));
  const archMeta = await archImg.metadata();
  const { data: archData, info: archInfo } = await archImg.raw().toBuffer({ resolveWithObject: true });

  // In test-arch-cleaned.png (width 576, height 498):
  // The baked text is around x: 380..540, y: 35..155.
  // The clean paper color in that section is around x: 360, y: 20 -> #F7EFE4
  // Let's sample the clean paper background at x: 350, y: 15
  const sampleIdx = (15 * archInfo.width + 350) * archInfo.channels;
  const paperR = archData[sampleIdx];
  const paperG = archData[sampleIdx + 1];
  const paperB = archData[sampleIdx + 2];

  // For pixels in the text region (x: 370..570, y: 25..160):
  // If the pixel is darker than the clean paper (i.e. text strokes), replace with clean paper color + subtle noise
  for (let y = 25; y < 165; y++) {
    for (let x = 360; x < 576; x++) {
      const idx = (y * archInfo.width + x) * archInfo.channels;
      if (archData[idx + 3] > 0) { // If not transparent
        const r = archData[idx];
        const g = archData[idx + 1];
        const b = archData[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const paperLum = 0.299 * paperR + 0.587 * paperG + 0.114 * paperB;
        // Text is darker than paper background
        if (lum < paperLum - 12 && !(r > 190 && g < 100 && b < 70 && y > 150)) {
          // Replace with clean paper texture color with subtle organic variance
          const noise = ((x * 13 + y * 17) % 7) - 3;
          archData[idx] = Math.min(255, Math.max(0, paperR + noise));
          archData[idx + 1] = Math.min(255, Math.max(0, paperG + noise));
          archData[idx + 2] = Math.min(255, Math.max(0, paperB + noise));
        }
      }
    }
  }

  await sharp(archData, {
    raw: {
      width: archInfo.width,
      height: archInfo.height,
      channels: archInfo.channels,
    }
  })
  .webp({ quality: 95, effort: 6 })
  .toFile(path.join(targetDir, 'problem-arch-duomo.webp'));

  console.log('7. Extracting footer-skyline.webp...');
  // From slice-6-footer.png, crop skyline sketch at bottom right
  // In slice-6-footer.png (352 x 124):
  // Sketch is around x: 235..352, y: 45..124
  const footerImg = sharp(path.join(refDir, 'slices', 'slice-6-footer.png'));
  const footerCrop = await footerImg
    .extract({ left: 235, top: 40, width: 117, height: 84 })
    .resize(350, 252, { kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  // Make background transparent: if pixel is close to cream paper (#F7EFE4)
  const fData = footerCrop.data;
  const fChannels = footerCrop.info.channels;
  const outBuf = Buffer.alloc(footerCrop.info.width * footerCrop.info.height * 4);

  for (let i = 0; i < footerCrop.info.width * footerCrop.info.height; i++) {
    const srcIdx = i * fChannels;
    const destIdx = i * 4;
    const r = fData[srcIdx];
    const g = fData[srcIdx + 1];
    const b = fData[srcIdx + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    // Ink strokes are dark (lum < 210)
    // Background paper is bright (lum > 225)
    let alpha = 0;
    if (lum < 235) {
      alpha = Math.round(Math.min(255, (235 - lum) * 2.2));
    }

    outBuf[destIdx] = Math.max(20, Math.min(80, r - 60)); // deep ink brown
    outBuf[destIdx + 1] = Math.max(25, Math.min(85, g - 60));
    outBuf[destIdx + 2] = Math.max(30, Math.min(95, b - 50));
    outBuf[destIdx + 3] = alpha;
  }

  await sharp(outBuf, {
    raw: {
      width: footerCrop.info.width,
      height: footerCrop.info.height,
      channels: 4,
    }
  })
  .webp({ quality: 95, effort: 6 })
  .toFile(path.join(targetDir, 'footer-skyline.webp'));

  console.log('8. Extracting orange-blob.webp...');
  // From slice-3-steps.png (352x120), extract orange blob at top left (x: 0..65, y: 0..85)
  const stepsImg = sharp(path.join(refDir, 'slices', 'slice-3-steps.png'));
  const blobCrop = await stepsImg
    .extract({ left: 0, top: 0, width: 65, height: 85 })
    .resize(195, 255, { kernel: 'lanczos3' })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const bData = blobCrop.data;
  const bChannels = blobCrop.info.channels;
  const bOut = Buffer.alloc(blobCrop.info.width * blobCrop.info.height * 4);

  for (let i = 0; i < blobCrop.info.width * blobCrop.info.height; i++) {
    const srcIdx = i * bChannels;
    const destIdx = i * 4;
    const r = bData[srcIdx];
    const g = bData[srcIdx + 1];
    const b = bData[srcIdx + 2];

    // Orange watercolor: high R, medium G, low B (r > 160, b < 160)
    // Paper background: r > 230, g > 220, b > 210
    const isOrange = (r > 180 && (r - b) > 50);
    let alpha = 0;
    if (isOrange) {
      alpha = Math.min(255, (r - b) * 2.2);
    }

    bOut[destIdx] = r;
    bOut[destIdx + 1] = g;
    bOut[destIdx + 2] = b;
    bOut[destIdx + 3] = Math.round(alpha);
  }

  await sharp(bOut, {
    raw: {
      width: blobCrop.info.width,
      height: blobCrop.info.height,
      channels: 4,
    }
  })
  .webp({ quality: 95, effort: 6 })
  .toFile(path.join(targetDir, 'orange-blob.webp'));

  console.log('All landing assets generated successfully in public/assets/landing/ !');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
