const sharp = require('sharp');
const path = require('path');

async function main() {
  const mockupPath = path.resolve(__dirname, '../design-reference/full-mockup.png');
  const image = sharp(mockupPath);
  const { data, info } = await image.raw().toBuffer({ resolveWithObject: true });

  function getPixel(x, y) {
    if (x < 0 || x >= info.width || y < 0 || y >= info.height) return null;
    const idx = (y * info.width + x) * info.channels;
    return {
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
      hex: '#' + [data[idx], data[idx + 1], data[idx + 2]].map(v => v.toString(16).padStart(2, '0')).join('')
    };
  }

  function sampleArea(x, y, radius = 1) {
    let r = 0, g = 0, b = 0, count = 0;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const p = getPixel(x + dx, y + dy);
        if (p) {
          r += p.r;
          g += p.g;
          b += p.b;
          count++;
        }
      }
    }
    const avgR = Math.round(r / count);
    const avgG = Math.round(g / count);
    const avgB = Math.round(b / count);
    const hex = '#' + [avgR, avgG, avgB].map(v => v.toString(16).padStart(2, '0')).join('');
    return { r: avgR, g: avgG, b: avgB, hex };
  }

  console.log('--- SAMPLED VALUES ---');

  // 1. Paper background
  const paper = sampleArea(30, 40, 2);
  console.log('Paper Background (cream):', paper.hex, `rgb(${paper.r}, ${paper.g}, ${paper.b})`);

  // 2. Ink heading (deep navy-black)
  let minLum = 255;
  let ink = null;
  // Headline is around x=30..60, y=80..130
  for (let x = 25; x < 80; x++) {
    for (let y = 80; y < 130; y++) {
      const p = getPixel(x, y);
      const lum = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
      if (lum < minLum) {
        minLum = lum;
        ink = p;
      }
    }
  }
  console.log('Ink Heading (navy-black):', ink ? ink.hex : 'N/A', `lum: ${minLum}`);

  // 3. Ember Orange ("with clarity.")
  let maxScore = -999;
  let ember = null;
  // "with clarity." is around x=25..120, y=120..150
  for (let x = 25; x < 120; x++) {
    for (let y = 120; y < 150; y++) {
      const p = getPixel(x, y);
      const score = p.r - p.b - p.g * 0.4;
      if (score > maxScore && p.r > 160) {
        maxScore = score;
        ember = p;
      }
    }
  }
  console.log('Ember Orange:', ember ? ember.hex : 'N/A');

  // 4. Deep Rust Panel (Section 4 background, around x=80..160, y=560..620)
  const rust = sampleArea(80, 580, 4);
  console.log('Deep Rust Panel:', rust.hex, `rgb(${rust.r}, ${rust.g}, ${rust.b})`);

  // 5. Healthy pill (around Position Card in Section 1, x=260..280, y=160..185)
  // Let's search around Position Card in slice 1
  let greenPill = null;
  let maxGreenScore = -999;
  for (let x = 250; x < 285; x++) {
    for (let y = 160; y < 185; y++) {
      const p = getPixel(x, y);
      const gScore = p.g - (p.r + p.b) / 2;
      if (gScore > maxGreenScore && p.g > 180) {
        maxGreenScore = gScore;
        greenPill = p;
      }
    }
  }
  console.log('Healthy Pill BG (soft green):', greenPill ? greenPill.hex : 'N/A');

  // Green text in pill
  let greenText = null;
  let maxGTextScore = -999;
  for (let x = 250; x < 285; x++) {
    for (let y = 160; y < 185; y++) {
      const p = getPixel(x, y);
      const gScore = p.g - (p.r + p.b) / 2;
      if (gScore > maxGTextScore && p.g < 160 && p.g > 90) {
        maxGTextScore = gScore;
        greenText = p;
      }
    }
  }
  console.log('Healthy Pill Text:', greenText ? greenText.hex : 'N/A');

  // 6. Gauge bar colors (Position card around y=205..215, x=190..285)
  let gaugeRed = null, gaugeAmber = null, gaugeGreen = null;
  for (let y = 205; y < 215; y++) {
    for (let x = 195; x < 225; x++) {
      const p = getPixel(x, y);
      if (p.r > 200 && p.g < 120 && p.b < 80) gaugeRed = p;
    }
    for (let x = 230; x < 255; x++) {
      const p = getPixel(x, y);
      if (p.r > 190 && p.g > 150 && p.b < 100) gaugeAmber = p;
    }
    for (let x = 260; x < 285; x++) {
      const p = getPixel(x, y);
      if (p.g > 160 && p.r < 170 && p.b < 140) gaugeGreen = p;
    }
  }
  console.log('Gauge Red/Orange:', gaugeRed ? gaugeRed.hex : 'N/A');
  console.log('Gauge Amber/Yellow:', gaugeAmber ? gaugeAmber.hex : 'N/A');
  console.log('Gauge Green:', gaugeGreen ? gaugeGreen.hex : 'N/A');

  // 7. Dark blue torn paper accent (Section 4 left, around x=10..30, y=550..600)
  let tornBlue = null;
  let maxBlue = -999;
  for (let x = 0; x < 30; x++) {
    for (let y = 540; y < 630; y++) {
      const p = getPixel(x, y);
      const bScore = p.b - (p.r + p.g) / 2;
      if (bScore > maxBlue && p.b > 50) {
        maxBlue = bScore;
        tornBlue = p;
      }
    }
  }
  console.log('Torn Blue Accent:', tornBlue ? tornBlue.hex : 'N/A');

  // 8. Card background
  const cardBg = sampleArea(230, 185, 2);
  console.log('Position Card BG:', cardBg.hex);
}

main().catch(console.error);
