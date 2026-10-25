# Ballast — Copy & Claim Audit

This document audits every factual claim made across the Ballast landing page, certifying that every statement is backed by verified smart contract source code, protocol constants, unit tests, or official documentation.

Per **Hard Rule 1**, any claim that cannot be proven from active code or verified artifacts has been deleted.

---

## 1. Verified Claims Audit Table

| # | Exact Landing Page Claim | Verification Category | Source File & Reference | Verification Evidence & Logic |
| :--- | :--- | :--- | :--- | :--- |
| **1** | *"Ballast keeps a Mezo borrower's Bitcoin-backed MUSD loan from being liquidated or redeemed..."* | Smart Contract Logic | `packages/contracts/src/BallastVault.sol` (lines 438–480)<br>`packages/contracts/src/libraries/BallastMath.sol` | When ICR drops below the user-configured trigger, the vault executes `repayMUSD()` or `addColl()` using pre-funded reserves to bring ICR back to `targetICR`, preventing trove liquidation at 110% and moving the trove out of the bottom redemption tier. |
| **2** | *"...using a reserve the borrower controls that anyone can deploy on their behalf."* | Access Control & Keeper Architecture | `packages/contracts/src/BallastVault.sol` (lines 331–368, 438–444) | Only `owner` (borrower) can call `depositMUSD()`, `depositBTC()`, `withdrawMUSD()`, or `withdrawBTC()`. The `defend()` function has no access modifier (permissionless), allowing any keeper or third party to trigger defense when `currentICR < rule.triggerICR`. |
| **3** | *"On Mezo, a MUSD loan is liquidated once its collateral ratio falls below 110%."* | Protocol Constant | `packages/shared/src/protocol.ts` (line 51)<br>`vendor/musd/solidity/contracts/TroveManager.sol` | `PROTOCOL_CONSTANTS.MCR = 1100000000000000000n` (110% / 1.1e18). MUSD troves with ICR < 110% undergo liquidation. (Previous mockups claiming 150% were audited and purged). |
| **4** | *"And when MUSD is redeemed, the loans with the lowest ratios are hit first."* | Protocol Mechanism | `vendor/musd/solidity/contracts/TroveManager.sol` (`redeemCollateral`)<br>`docs/PROTOCOL_NOTES.md` | Redemptions in Liquity/MUSD protocols sort active troves in ascending order via `ISortedTroves`. Redemptions redeem face value collateral starting from the lowest ICR trove. |
| **5** | *"Repays debt or adds BTC from your reserve"* | Execution Logic | `packages/contracts/src/BallastVault.sol` (lines 465–478)<br>`packages/contracts/src/libraries/BallastMath.sol` | Vault first prioritizes MUSD debt repayment from `musdReserve`; if additional ratio boost is needed, it deposits native BTC from `btcReserve`. |
| **6** | *"Your vault, no admin keys"* | Security & Governance | `packages/contracts/src/BallastFactory.sol` (lines 10–13, 20–59)<br>`packages/contracts/src/BallastVault.sol` (line 33, lines 39–42) | `BallastFactory` has no owner, no admin, no pause, no fees, and no upgrade proxy. `BallastVault` minimal proxy clones have only one address authorized (`owner = msg.sender`). No team key or governance key has authority over any vault. |
| **7** | *"A personal vault holds your MUSD loan. Only you can withdraw from it."* | Smart Contract Ownership | `packages/contracts/src/BallastVault.sol` (lines 79–100, 348–368) | Troves on Mezo require `msg.sender == borrower`. Each user owns an immutable minimal proxy (`BallastVault`) that acts as borrower. All withdrawal functions enforce `onlyOwner`. |
| **8** | *"When your ratio hits the trigger, anyone can repay debt or add collateral from your reserve, back to your target."* | Automation Rules | `packages/contracts/src/BallastVault.sol` (lines 401–480)<br>`packages/shared/src/math.ts` (`computeDefenseAmounts`) | `checkDefense()` returns `defendable = true` when `currentICR < rule.triggerICR`. `defend()` recomputes amounts dynamically against live oracle prices and restores trove to `targetICR`. |
| **9** | *"You get a Telegram alert."* | Notification Pipeline | `convex/telegram.ts`<br>`apps/keeper/src/telegram/alerts.ts`<br>`apps/web/src/app/app/alerts/page.tsx` | Full cryptographic signature binding pipeline (`verifyAndLink`) connecting user wallet addresses to verified Telegram chat IDs with customizable warning thresholds. |
| **10** | *"Example position: Collateral Ratio 166.7%, $10,000 Collateral, $6,000 Debt, 110% Liquidation, 135% Trigger, 160% Target"* | Mathematical Truth | `packages/shared/src/math.ts` (`computeICR`) | $\text{ICR} = \frac{\$10,000}{\$6,000} = 166.\overline{6}\% \approx 166.7\%$. Computed via pure fixed-point function, replacing invalid mockup figures. |
| **11** | *"Ballast sits on top of Mezo's own MUSD contracts: open source, no custody, no admin keys."* | Contract Architecture | `packages/contracts/src/BallastVault.sol`<br>`deployments/matsnet.json` | Directly integrates with Mezo's `BorrowerOperations` (`0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`), `TroveManager`, and `PriceFeed`. Fully open source under MIT. |
| **12** | *"Ballast lowers liquidation risk; it cannot remove it. Reserves can run out and prices can gap. Testnet prototype, unaudited."* | Risk Model & Disclosure | `docs/SPEC.md`<br>`docs/THREAT_MODEL.md` | Transparent, honest disclosure of protocol constraints: rapid market cascade wicks can bypass keeper blocks; finite reserves cannot defend infinite price declines. |
| **13** | *"Verified On-Chain Contracts (Mezo Matsnet Testnet · Chain ID 31611)"* | Deployment Ground Truth | `deployments/matsnet.json`<br>`apps/web/src/lib/deployment.ts` | Factory: `0x8d5b392839300b487addeecc35f5bc534111cd33`<br>Master Implementation: `0x815893bad1708a201eeeaf226eed576a7ffea4bc`<br>Sample Vault Clone: `0xA5062C7F7243c3d5267bC1c9a620ea71a9435D5A`. Verified on Blockscout. |

---

## 2. Deleted & Purged Unverified Claims

In compliance with **Hard Rules 1, 4, and 5**, the following unverified, misleading, or mockup artifacts have been completely purged from the codebase:

1. **Purged Mockup Liquidation Figures (150% Liquidation, 200% Caution)**:
   - *Reason*: Inaccurate Liquity v1 clone mockup artifact. Mezo MUSD uses strictly **110% MCR**. All UI instances now dynamically reference `PROTOCOL_CONSTANTS.MCR` (110%).
2. **Purged Mockup Inconsistent Math (226.7% ICR with $10k Collateral and $3k Debt)**:
   - *Reason*: $\frac{\$10,000}{\$3,000} = 333.3\% \neq 226.7\%$. Replaced with mutually consistent, shared-math verified values: Collateral \$10,000, Debt \$6,000, Ratio **166.7%**.
3. **Purged Keeper Frequency Guarantees ("Every 30 seconds")**:
   - *Reason*: The production hosted continuous keeper is a testnet prototype. We state the truthful on-chain reality: **"anyone can trigger a defense"** via permissionless smart contract calls.
4. **Purged Whitepaper Links**:
   - *Reason*: No formal whitepaper PDF exists. Replaced with direct links to verified developer documentation and security specifications.
5. **Purged Newsletter Email Form**:
   - *Reason*: No backend email capture server is deployed. Replaced with a direct, functional action: **"Get liquidation alerts on Telegram"** linking to the active bot and in-app wallet binding flow.
6. **Purged Testimonials, Fake Partner Logos, TVL, and User Metrics**:
   - *Reason*: Prohibited by AGENTS.md Rule 1 (Zero Mocks in Product Code).
