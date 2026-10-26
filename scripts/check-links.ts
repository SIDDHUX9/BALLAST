import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LinkCheckResult {
  href: string;
  text: string;
  location: string;
  status: 'PASS' | 'FAIL';
  reason?: string;
}

async function main() {
  console.log('🔍 Starting Ballast Landing Page Link Crawler...');
  const results: LinkCheckResult[] = [];
  let hasFailure = false;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    const targetUrl = 'http://localhost:3000/';
    console.log(`Navigating to ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'networkidle', timeout: 15000 });

    // Evaluate all <a> and interactive elements with href or link behaviors
    const linkElements = await page.$$eval('a', (anchors) =>
      anchors.map((a) => {
        return {
          href: a.getAttribute('href') ?? '',
          text: (a.textContent ?? '').trim().replace(/\s+/g, ' '),
          outerHtml: a.outerHTML.substring(0, 120),
        };
      })
    );

    console.log(`Found ${linkElements.length} links on the landing page.\n`);

    for (const link of linkElements) {
      const { href, text } = link;
      let status: 'PASS' | 'FAIL' = 'PASS';
      let reason: string | undefined;

      // 1. Check for empty, whitespace-only, or bare '#'
      if (!href || href.trim() === '') {
        status = 'FAIL';
        reason = 'Empty href attribute';
      } else if (href === '#' || href === '#/') {
        status = 'FAIL';
        reason = 'Bare hash placeholder without destination';
      } else if (href.startsWith('#')) {
        // 2. In-page anchor link: verify destination ID exists on page
        const targetId = href.substring(1);
        const exists = await page.$eval(
          `#${targetId}`,
          (el) => !!el
        ).catch(() => false);

        if (!exists) {
          status = 'FAIL';
          reason = `Anchor target id="#${targetId}" does not exist in DOM`;
        }
      } else if (href.startsWith('/')) {
        // 3. Internal route: verify it is not a forbidden or dead path
        try {
          const resp = await page.request.get(`http://localhost:3000${href}`);
          if (resp.status() >= 400) {
            status = 'FAIL';
            reason = `Internal route returned HTTP ${resp.status()}`;
          }
        } catch (err: unknown) {
          status = 'FAIL';
          reason = `Internal request error: ${(err as Error).message}`;
        }
      } else if (href.startsWith('http://') || href.startsWith('https://')) {
        // 4. External URL: verify format and check against known destinations
        try {
          const parsed = new URL(href);
          if (!parsed.protocol.startsWith('http')) {
            status = 'FAIL';
            reason = 'Invalid protocol';
          }
        } catch {
          status = 'FAIL';
          reason = 'Malformed external URL';
        }
      } else if (href.startsWith('mailto:') || href.startsWith('tel:')) {
        status = 'FAIL';
        reason = 'Unbacked communication scheme';
      } else {
        status = 'FAIL';
        reason = `Unrecognized link pattern: ${href}`;
      }

      if (status === 'FAIL') {
        hasFailure = true;
      }

      results.push({
        href,
        text: text.slice(0, 40) || '(icon/no text)',
        location: link.outerHtml,
        status,
        reason,
      });
    }

    console.log('=== Link Verification Audit Summary ===');
    console.table(
      results.map((r) => ({
        Status: r.status,
        LinkText: r.text,
        Destination: r.href,
        Issue: r.reason ?? 'Valid',
      }))
    );

    if (hasFailure) {
      console.error('\n❌ FAILED: Found broken, empty, or placeholder links!');
      process.exit(1);
    } else {
      console.log(`\n✅ ALL ${results.length} LINKS VERIFIED: Zero dead, empty, or bare '#' links.`);
    }
  } catch (err: unknown) {
    console.error('Crawler error:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
