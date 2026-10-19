import fs from 'node:fs';
import path from 'node:path';

const FORBIDDEN_STRING = 'E2E_BURNER_CONNECTOR_DO_NOT_SHIP_TO_PRODUCTION';
const NEXT_DIR = path.resolve('apps/web/.next');

if (!fs.existsSync(NEXT_DIR)) {
  console.error('[CLEAN BUNDLE CHECK] Error: apps/web/.next directory does not exist. Run "pnpm --filter @ballast/web build" first.');
  process.exit(1);
}

function searchDirectory(dir) {
  let found = false;
  const files = fs.readdirSync(dir, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    if (file.isDirectory()) {
      if (searchDirectory(fullPath)) found = true;
    } else if (file.isFile() && (file.name.endsWith('.js') || file.name.endsWith('.html') || file.name.endsWith('.json'))) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(FORBIDDEN_STRING)) {
        console.error(`[RULE 2 VIOLATION] Test double "${FORBIDDEN_STRING}" detected in production bundle: ${fullPath}`);
        found = true;
      }
    }
  }

  return found;
}

console.log('[CLEAN BUNDLE CHECK] Scanning production build for prohibited test doubles and burner connectors...');
const hasViolation = searchDirectory(NEXT_DIR);

if (hasViolation) {
  console.error('[CLEAN BUNDLE CHECK] FAILED: Production build contains test-only doubles. Rejecting build.');
  process.exit(1);
}

console.log('[CLEAN BUNDLE CHECK] PASSED: No test doubles or burner connectors found in production bundle.');
process.exit(0);
