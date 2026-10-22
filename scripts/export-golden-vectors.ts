import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Exact vectors derived directly from BallastMath.sol and verified via Forge tests
const goldenVectors = [
  {
    name: 'Standard Trove: 0.05 BTC @ $80k, 2500 MUSD debt',
    collateral: '50000000000000000', // 0.05 BTC
    price: '80000000000000000000000', // $80,000
    debt: '2500000000000000000000', // 2,500 MUSD
    mcr: '1100000000000000000', // 110%
    targetICR: '1500000000000000000', // 150%
    minNetDebt: '1800000000000000000000', // 1,800 MUSD
    musdReserve: '1000000000000000000000', // 1,000 MUSD
    btcReserve: '100000000000000000', // 0.1 BTC
    expectedICR: '1600000000000000000', // 160%
    expectedLiquidationPrice: '55000000000000000000000', // $55,000
    expectedRepayNeeded: '0', // Already at 160% > 150%
    expectedBtcNeeded: '0',
    expectedTip50Bps: '0',
  },
  {
    name: 'Trove Needing Repay Defense: 0.05 BTC @ $80k, 3000 MUSD debt (133.3% ICR)',
    collateral: '50000000000000000', // 0.05 BTC ($4,000)
    price: '80000000000000000000000', // $80,000
    debt: '3000000000000000000000', // 3,000 MUSD
    mcr: '1100000000000000000', // 110%
    targetICR: '1500000000000000000', // 150%
    minNetDebt: '1800000000000000000000', // 1,800 MUSD
    musdReserve: '1000000000000000000000', // 1,000 MUSD
    btcReserve: '0',
    expectedICR: '1333333333333333333', // 133.33%
    expectedLiquidationPrice: '66000000000000000000000', // $66,000
    expectedRepayNeeded: '333333333333333333334', // ~333.33 MUSD
    expectedBtcNeeded: '0',
    expectedTip50Bps: '1666666666666666666', // 0.5% tip on 333.33 MUSD
  },
  {
    name: 'Trove Needing Collateral Defense: 0.02 BTC @ $80k, 2000 MUSD debt (80% ICR)',
    collateral: '20000000000000000', // 0.02 BTC ($1,600)
    price: '80000000000000000000000', // $80,000
    debt: '2000000000000000000000', // 2,000 MUSD
    mcr: '1100000000000000000', // 110%
    targetICR: '1500000000000000000', // 150%
    minNetDebt: '1800000000000000000000', // 1,800 MUSD
    musdReserve: '0',
    btcReserve: '1000000000000000000', // 1 BTC
    expectedICR: '800000000000000000', // 80%
    expectedLiquidationPrice: '110000000000000000000000', // $110,000
    expectedRepayNeeded: '0',
    expectedBtcNeeded: '17500000000000000', // 0.0175 BTC
    expectedTip50Bps: '87500000000000', // 0.5% tip on 0.0175 BTC
  },
  {
    name: 'Min Net Debt Clamping: Debt 2100 MUSD (Net 1900 MUSD) -> Repay clamped to 100 MUSD',
    collateral: '30000000000000000', // 0.03 BTC ($2,400)
    price: '80000000000000000000000', // $80,000
    debt: '2100000000000000000000', // 2,100 MUSD
    mcr: '1100000000000000000', // 110%
    targetICR: '1500000000000000000', // 150%
    minNetDebt: '1800000000000000000000', // 1,800 MUSD
    musdReserve: '1000000000000000000000', // 1,000 MUSD
    btcReserve: '0',
    expectedICR: '1142857142857142857', // 114.28%
    expectedLiquidationPrice: '77000000000000000000000', // $77,000
    expectedRepayNeeded: '100000000000000000000', // Exactly clamped to 100 MUSD
    expectedBtcNeeded: '0',
    expectedTip50Bps: '500000000000000000', // 0.5 MUSD
  },
];

const targetPath = path.join(rootDir, 'packages/shared/tests/golden-vectors.json');
fs.writeFileSync(targetPath, JSON.stringify(goldenVectors, null, 2) + '\n');
console.log(`✓ Exported ${goldenVectors.length} golden vectors to ${targetPath}`);
