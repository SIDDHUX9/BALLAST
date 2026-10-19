import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const contractsDir = path.join(rootDir, 'packages', 'contracts');
const deploymentsDir = path.join(rootDir, 'deployments');

function getForgeCmd(): string {
  const customPath = path.join(os.homedir(), '.foundry', 'bin', process.platform === 'win32' ? 'forge.exe' : 'forge');
  if (fs.existsSync(customPath)) {
    return `"${customPath}"`;
  }
  return 'forge';
}

const forgeCmd = getForgeCmd();

const contracts = [
  {
    name: 'BallastFactory',
    target: 'src/BallastFactory.sol:BallastFactory',
    outFile: 'BallastFactory-standard-input.json',
  },
  {
    name: 'BallastVault',
    target: 'src/BallastVault.sol:BallastVault',
    outFile: 'BallastVault-standard-input.json',
  },
];

for (const c of contracts) {
  console.log(`Generating standard-json input for ${c.name}...`);
  const cmd = `${forgeCmd} verify-contract --show-standard-json-input 0x0000000000000000000000000000000000000000 ${c.target}`;
  const output = execSync(cmd, { cwd: contractsDir, encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });

  // Find start of JSON
  const jsonStart = output.indexOf('{');
  if (jsonStart === -1) {
    console.error(`Failed to find JSON in output for ${c.name}`);
    continue;
  }
  const jsonStr = output.slice(jsonStart).trim();
  // Validate JSON
  JSON.parse(jsonStr);

  const destPath = path.join(deploymentsDir, c.outFile);
  fs.writeFileSync(destPath, jsonStr, { encoding: 'utf-8' });
  console.log(`✓ Saved ${destPath}`);
}
