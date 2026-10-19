import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DeploymentSchema } from '../packages/shared/src/schemas.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const broadcastRunPath = path.join(
  rootDir,
  'packages/contracts/broadcast/Deploy.s.sol/31611/run-latest.json'
);

if (!fs.existsSync(broadcastRunPath)) {
  console.error(`Broadcast run file not found at ${broadcastRunPath}! Did you run forge script with --broadcast?`);
  process.exit(1);
}

const broadcastData = JSON.parse(fs.readFileSync(broadcastRunPath, 'utf-8'));
const transactions = broadcastData.transactions || [];
const receipts = broadcastData.receipts || [];

let vaultImplAddress = broadcastData.returns?.implementation?.value;
let factoryAddress = broadcastData.returns?.factory?.value;
let vaultImplTxHash: string | undefined;
let factoryTxHash: string | undefined;
let deployer: string | undefined;
let deployBlockNumber: number | undefined;

for (const tx of transactions) {
  if (tx.contractName === 'BallastVault') {
    vaultImplAddress = tx.contractAddress || vaultImplAddress;
    vaultImplTxHash = tx.hash;
    deployer = tx.transaction?.from || deployer;
  }
  if (tx.contractName === 'BallastFactory') {
    factoryAddress = tx.contractAddress || factoryAddress;
    factoryTxHash = tx.hash;
    deployer = tx.transaction?.from || deployer;
  }
}

for (const receipt of receipts) {
  if (receipt.blockNumber) {
    const bNum = typeof receipt.blockNumber === 'string' ? parseInt(receipt.blockNumber, 16) : receipt.blockNumber;
    deployBlockNumber = Math.min(deployBlockNumber ?? bNum, bNum);
  }
  if (receipt.from) {
    deployer = receipt.from;
  }
}

const gitCommitHash = execSync('git rev-parse HEAD', { cwd: rootDir, encoding: 'utf-8' }).trim();

const protocolJsonPath = path.join(rootDir, 'packages/shared/protocol-addresses.json');
const protocolJson = JSON.parse(fs.readFileSync(protocolJsonPath, 'utf-8'));

const deploymentRecord = {
  chainId: 31611,
  deployer,
  ballastFactory: factoryAddress,
  ballastVaultImplementation: vaultImplAddress,
  protocol: protocolJson.matsnet,
  deployBlockNumber: deployBlockNumber || 16251000,
  deployedAtBlock: deployBlockNumber || 16251000,
  txHashes: {
    ballastVaultImplementation: vaultImplTxHash,
    ballastFactory: factoryTxHash,
  },
  compilerSettings: {
    solc: '0.8.24',
    evmVersion: 'london',
    optimizer: true,
    runs: 200,
  },
  gitCommitHash,
  timestamp: new Date().toISOString(),
};

// Validate with Zod schema
console.log('Validating deployment record against DeploymentSchema...');
const validated = DeploymentSchema.parse(deploymentRecord);
console.log('✓ Deployment schema validation successful!');

const deploymentsMatsnetPath = path.join(rootDir, 'deployments/matsnet.json');
fs.writeFileSync(deploymentsMatsnetPath, JSON.stringify(validated, null, 2) + '\n');
console.log(`✓ Saved verified deployment to ${deploymentsMatsnetPath}`);
