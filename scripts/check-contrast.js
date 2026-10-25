// WCAG 2.1 Relative Luminance & Contrast Ratio Calculator

function hexToRgb(hex) {
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(x => x + x).join('');
  }
  const num = parseInt(c, 16);
  return [num >> 16, (num >> 8) & 255, num & 255];
}

function relativeLuminance(rgb) {
  const [r, g, b] = rgb.map(val => {
    const s = val / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(hex1, hex2) {
  const lum1 = relativeLuminance(hexToRgb(hex1));
  const lum2 = relativeLuminance(hexToRgb(hex2));
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

const lightTokens = {
  paper: '#F4F1EA',
  paperRaised: '#FBFAF6',
  ink: '#14130F',
  inkSoft: '#3A3830',
  muted: '#6B675C',
  safe: '#2F6F5E',
  watch: '#B7791F',
  danger: '#A32020',
  ember: '#B8431F',
};

const darkTokens = {
  ground: '#0E0E0C',
  surface: '#151512',
  text: '#EDE9DF',
  muted: '#8F8A7C',
  safe: '#449B85', // adjusted if needed for dark ground
  watch: '#D9983B',
  danger: '#E04A4A',
  ember: '#D95C34',
};

console.log('=== WCAG AA Contrast Audit ===\n');

let failed = false;

function check(fgName, fgHex, bgName, bgHex, minRatio = 4.5, isLargeTextOrUi = false) {
  const ratio = contrastRatio(fgHex, bgHex);
  const target = isLargeTextOrUi ? 3.0 : minRatio;
  const passes = ratio >= target;
  const status = passes ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${fgName} (${fgHex}) on ${bgName} (${bgHex}): ${ratio.toFixed(2)}:1 (target: ${target}:1)`);
  if (!passes) failed = true;
  return ratio;
}

console.log('-- Light Theme Pairs --');
check('ink', lightTokens.ink, 'paper', lightTokens.paper);
check('ink', lightTokens.ink, 'paperRaised', lightTokens.paperRaised);
check('inkSoft', lightTokens.inkSoft, 'paper', lightTokens.paper);
check('inkSoft', lightTokens.inkSoft, 'paperRaised', lightTokens.paperRaised);
check('muted', lightTokens.muted, 'paper', lightTokens.paper);
check('safe', lightTokens.safe, 'paper', lightTokens.paper);
check('danger', lightTokens.danger, 'paper', lightTokens.paper);
check('ember', lightTokens.ember, 'paper', lightTokens.paper);
check('watch', lightTokens.watch, 'paper', lightTokens.paper, 3.0, true); // UI badges / large text
check('paperRaised', lightTokens.paperRaised, 'ember (button fg)', lightTokens.ember);
check('paperRaised', lightTokens.paperRaised, 'ink (button fg)', lightTokens.ink);

console.log('\n-- Dark Theme Pairs --');
check('text', darkTokens.text, 'ground', darkTokens.ground);
check('text', darkTokens.text, 'surface', darkTokens.surface);
check('muted', darkTokens.muted, 'ground', darkTokens.ground);
check('muted', darkTokens.muted, 'surface', darkTokens.surface);
check('safe', darkTokens.safe, 'ground', darkTokens.ground);
check('watch', darkTokens.watch, 'ground', darkTokens.ground);
check('danger', darkTokens.danger, 'ground', darkTokens.ground);
check('ember', darkTokens.ember, 'ground', darkTokens.ground);
check('ground', darkTokens.ground, 'ember (button fg)', darkTokens.ember);

console.log('\n-- Rust Simulator Panel (Landing Page Section 4) --');
const rustBg = '#C1411C';
const darkRustBg = '#A83514';
check('Eyebrow text', '#FFFFFF', 'Rust panel bg', rustBg, 4.5);
check('Headline (Large)', '#FFFFFF', 'Rust panel bg', rustBg, 3.0, true);
check('Body paragraph text', '#FFFFFF', 'Rust panel bg', rustBg, 4.5);
check('Eyebrow text', '#FFFFFF', 'Dark rust shadow bg', darkRustBg, 4.5);
check('Body paragraph text', '#FFFFFF', 'Dark rust shadow bg', darkRustBg, 4.5);
check('Button text', '#FFFFFF', 'Button bg ink', '#0A1521', 4.5);
check('Card heading ink', '#0A1521', 'Card white bg', '#FFFFFF', 4.5);

if (failed) {
  console.error('\nContrast check failed for one or more pairs!');
  process.exit(1);
} else {
  console.log('\nAll token pairs and Rust panel text passed WCAG AA requirements!');
}
