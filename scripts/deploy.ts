import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const contractsDir = path.join(rootDir, 'packages', 'contracts');

function getForgeCmd(): string {
  const customPath = path.join(os.homedir(), '.foundry', 'bin', process.platform === 'win32' ? 'forge.exe' : 'forge');
  if (fs.existsSync(customPath)) {
    return customPath;
  }
  return 'forge';
}

// 1. Read private key from .env securely
const envPath = path.join(rootDir, '.env');
if (!fs.existsSync(envPath)) {
  console.error('ERROR: .env file not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf-8');
const match = envContent.match(/PRIVATE_KEY\s*=\s*([0-9a-fA-F]+)/);
if (!match) {
  console.error('ERROR: Could not find PRIVATE_KEY in .env!');
  process.exit(1);
}

const privateKey = (match[1].startsWith('0x') ? match[1] : '0x' + match[1]).trim();

const forgeCmd = getForgeCmd();
console.log(`Using Forge binary: ${forgeCmd}`);
console.log('Broadcasting deployment to Mezo Testnet (Chain ID 31611)...');

const forgeResult = spawnSync(
  forgeCmd,
  [
    'script',
    'script/Deploy.s.sol:DeployScript',
    '--rpc-url',
    'https://rpc.test.mezo.org',
    '--broadcast',
    '--private-key',
    privateKey,
  ],
  {
    cwd: contractsDir,
    stdio: 'inherit',
    encoding: 'utf-8',
  }
);

if (forgeResult.status !== 0) {
  console.error(`Forge script broadcast failed with code ${forgeResult.status}`);
  process.exit(forgeResult.status || 1);
}

console.log('\n✓ Deployment transactions broadcast successfully!');

// 2. Record deployment
console.log('\nRecording deployment metadata to deployments/matsnet.json...');
execSync('npx tsx scripts/record-deployment.ts', { cwd: rootDir, stdio: 'inherit' });

// 3. Export typed ABIs
console.log('\nExporting contract ABIs and updating packages/shared...');
execSync('pnpm contracts:export', { cwd: rootDir, stdio: 'inherit' });

// 4. Generate standard-json inputs for Blockscout explorer
console.log('\nGenerating standard-json inputs...');
execSync('npx tsx scripts/generate-standard-json.ts', { cwd: rootDir, stdio: 'inherit' });

console.log('\n=== ALL DEPLOYMENT ARTIFACTS RECORDED & UPDATED ===');
