# Ballast — Deployment & Verification Guide

This document records the official deployment of **Ballast** smart contracts on the **Mezo Testnet (Matsnet)**, deployment transaction hashes, explorer links, source verification metadata, and instructions for how client applications (`apps/web`) and automated services (`apps/keeper`) ingest the deployment artifact.

---

## 1. Network & Contract Addresses

| Property | Value |
| :--- | :--- |
| **Network** | Mezo Testnet (Matsnet) |
| **Chain ID** | `31611` (`0x7b7b`) |
| **RPC Endpoint** | `https://rpc.test.mezo.org` |
| **Block Explorer** | `https://explorer.test.mezo.org` |
| **Deployer Address** | [`0xb6ba1be32b7ca2729551882b71e8f469d06510e6`](https://explorer.test.mezo.org/address/0xb6ba1be32b7ca2729551882b71e8f469d06510e6) |
| **Deployment Block** | `16251639` *(Keeper event indexing start block)* |

### Deployed Core Contracts

| Contract | Address | Explorer Link | Creation Tx Hash |
| :--- | :--- | :--- | :--- |
| **BallastVault** *(Implementation)* | `0x815893bad1708a201eeeaf226eed576a7ffea4bc` | [View on Explorer](https://explorer.test.mezo.org/address/0x815893bad1708a201eeeaf226eed576a7ffea4bc) | [`0xc6b3ee1e...`](https://explorer.test.mezo.org/tx/0xc6b3ee1e16f4e990edb6084ac13f2056ad2f95446052958f39df3b2d04b4a044) |
| **BallastFactory** | `0x8d5b392839300b487addeecc35f5bc534111cd33` | [View on Explorer](https://explorer.test.mezo.org/address/0x8d5b392839300b487addeecc35f5bc534111cd33) | [`0xa5da037b...`](https://explorer.test.mezo.org/tx/0xa5da037bc4a15211bbe68508be6eacc629230a8ef1267a076b6e05a48dd32473) |

---

## 2. Real Testnet Smoke Test Execution

A complete, real on-chain end-to-end lifecycle test was executed using `scripts/smoke.ts` on Mezo testnet. Every transaction was mined and verified on-chain:

| Step | Action | Tx Hash / Details | Explorer Link |
| :---: | :--- | :--- | :--- |
| **1** | Deploy Vault Clone | `0xa668c363...` (Vault: `0xA506b2250B85A0c7dE80DD313A0Db9cD8a655D5A`) | [View Tx](https://explorer.test.mezo.org/tx/0xa668c363368da7af882524f60198bda8051fd6940f95a1e7dab4f5f8d80d72ca) |
| **2** | Hint Resolution | `upper=0x80e8f5AE...`, `lower=0x974a3275...` ($O(1)$ linked list query) | Computed via `SortedTroves` |
| **3** | Open Trove | `0xeacf160e...` (0.038 BTC coll, 2,001.8 MUSD debt, 155.66% ICR) | [View Tx](https://explorer.test.mezo.org/tx/0xeacf160e9dfdc3f38878156d3474465b823e785dcf1f863973e36c6802a3594e) |
| **4** | Configure Rule | `0xe2428f6b...` (trigger: 125%, target: 140%, maxTip: 50 bps) | [View Tx](https://explorer.test.mezo.org/tx/0xe2428f6be6f308c1065871d3029f831df67ad10eb2c12389e1be3316c205517e) |
| **5** | Deposit BTC Reserve | `0x9945f7c9...` (0.002 BTC deposited into vault reserve) | [View Tx](https://explorer.test.mezo.org/tx/0x9945f7c90737d18d5264234acb6f5e8d6c79cc5ed6f0cc895d95759254c79b79) |
| **6** | Approve MUSD Reserve | `0x1287c78f...` (50 MUSD approved to vault) | [View Tx](https://explorer.test.mezo.org/tx/0x1287c78ffc737adb93285b514abcdf9c714e4a5a2b85c1104d6336b3a6196047) |
| **7** | Deposit MUSD Reserve | `0x41d42872...` (50 MUSD deposited into vault reserve) | [View Tx](https://explorer.test.mezo.org/tx/0x41d42872df37df7360693e2b4d32bd094fdfb4027357cd8b5b01b3e8ff5dfa2e) |
| **8** | Inspect `checkDefense` | `isDefendable: false`, `currentICR: 155.66%`, `repay: 0`, `coll: 0` | On-chain view assertion |
| **9** | Withdraw BTC Reserve | `0x47021f9c...` (0.002 BTC refunded to owner) | [View Tx](https://explorer.test.mezo.org/tx/0x47021f9c4feb2d926bbe70b7054bf343c6e21055da3ea085ce313d79319fcf58) |
| **10** | Withdraw MUSD Reserve| `0xfe9875e4...` (50 MUSD refunded to owner) | [View Tx](https://explorer.test.mezo.org/tx/0xfe9875e456aef59b73afb6c7ccbfff70a746560707b34ea70e373951d4f9cf47) |

---

## 3. Real Network Behaviors vs. Fork Tests

1. **EIP-7623 Floor Data Gas Requirement**:
   - *Observation*: Transactions with very low gas limits (e.g., standard minimal 21,000 gas estimations) revert at the node level with `gas limit below EIP-7623 floor: 21064 (gas limit) < 21160 (floor data gas)`.
   - *Solution*: `sendTx` and client interaction helpers enforce a minimum gas limit of 150,000 to 250,000 gas and apply a 150% buffer over `estimateContractGas`.
2. **HintHelpers `getApproxHint` RPC Computation Limits**:
   - *Observation*: Invoking `getApproxHint(nicr, 3930, seed)` via an RPC `eth_call` on the public Mezo testnet endpoint reverts due to gas limits inside geth view evaluation loops.
   - *Solution*: Hint computation uses $O(1)$ linked-list neighbor finding with `SortedTroves.getFirst()` and `SortedTroves.getLast()` passed to `findInsertPosition(nicr, first, last)`.
3. **MUSD Borrowing Fee Debt Dynamic**:
   - *Observation*: Opening a 1,800 MUSD debt mints exactly 1,800 MUSD to the borrower, but incurs a 0.1% protocol borrowing fee (1.8 MUSD) added to the debt. Closing a trove requires `netDebt = debt - 200 = 1,801.8 MUSD`.
   - *Documentation*: Documented in protocol dynamics; closing an active trove requires obtaining the 1.8 MUSD fee from outside yield or secondary liquidity.

---

## 4. Contract Verification Status & Standard JSON Inputs

Mezo testnet uses a hosted Next.js Blockscout frontend without open public `/api` or `/contract_verification` verification endpoints (`/api` returns 404), and the commercial Blockscout Pro API requires authentication.

Per specification, full standalone Standard JSON compiler inputs have been generated and committed to the repository for manual verification via any explorer upload UI:

- **Factory Standard JSON**: [`deployments/BallastFactory-standard-input.json`](file:///c:/Users/Siddhu/Downloads/BALLAST/deployments/BallastFactory-standard-input.json)
- **Vault Standard JSON**: [`deployments/BallastVault-standard-input.json`](file:///c:/Users/Siddhu/Downloads/BALLAST/deployments/BallastVault-standard-input.json)

---

## 5. How Applications Read Deployments

The single source of truth for deployments is [`deployments/matsnet.json`](file:///c:/Users/Siddhu/Downloads/BALLAST/deployments/matsnet.json), validated strictly by `DeploymentSchema` in [`packages/shared/src/schemas.ts`](file:///c:/Users/Siddhu/Downloads/BALLAST/packages/shared/src/schemas.ts).

### In `apps/web`
The web application imports typed addresses and ABIs directly from `@ballast/shared`:
```typescript
import { BallastFactoryAbi, BallastVaultAbi, getDeployment } from '@ballast/shared';
import matsnetDeployment from '@ballast/deployments/matsnet.json';

const factoryAddress = matsnetDeployment.ballastFactory;
```

### In `apps/keeper`
The keeper daemon initializes its event log subscription starting from `deployBlockNumber`:
```typescript
import matsnetDeployment from '@ballast/deployments/matsnet.json';

const startBlock = BigInt(matsnetDeployment.deployBlockNumber); // 16251639
const factoryAddress = matsnetDeployment.ballastFactory;

// Listen for VaultCreated events without scanning prior history
```

---

## 6. How to Redeploy (Idempotent Flow)

To redeploy or verify deployment idempotency:

1. Perform a dry-run simulation:
   ```bash
   pnpm --filter @ballast/contracts exec forge script script/Deploy.s.sol:DeployScript --rpc-url https://rpc.test.mezo.org
   ```
2. Broadcast on-chain:
   ```bash
   pnpm run deploy
   ```
3. Run the live smoke test:
   ```bash
   pnpm run smoke
   ```
