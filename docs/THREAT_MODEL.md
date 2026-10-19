# Ballast Threat Model & Security Analysis

## 1. Security Objectives & Invariants

Ballast is designed with strict non-custodial and trust-minimized security guarantees:

1. **Non-Custodial Isolation**: No user's funds (collateral, debt, or reserves) can ever be accessed, seized, or affected by another user, a keeper, or any protocol administrator.
2. **Deterministic Ownership**: Only the verified owner of a `BallastVault` may open/close troves, withdraw reserves, update defense rules, or sweep non-reserve tokens.
3. **Monotonic Health Improvement**: The permissionless `defend()` entrypoint can NEVER worsen a trove's collateral ratio; it must strictly improve ICR ($\text{newICR} > \text{oldICR}$).
4. **Strict Tip Ceiling**: A keeper can never extract more than the owner's configured `maxTipBps` (capped at 100 bps = 1.00%) on actual value deployed.
5. **No Admin Privileges**: The `BallastFactory` and `BallastVault` have no owner keys, no upgrade proxies, no pausing, and no protocol fee extraction logic.

---

## 2. Threat Matrix

| Asset                       | Attacker                      | Attack Vector                                             | Impact                                                         | Mitigation                                                                                                                                                                             | Residual Risk                                                                       |
| --------------------------- | ----------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **BTC Collateral in Trove** | Malicious Actor               | Unauthorized trove collateral withdrawal                  | Total loss of borrower collateral                              | Vault only allows `msg.sender == owner` to invoke `withdrawColl` / `adjustTrove` with collateral withdrawal.                                                                           | Compromise of owner private key.                                                    |
| **MUSD Defense Reserve**    | Rogue Keeper                  | Excessive tip extraction via arbitrary defense triggers   | Drainage of user MUSD reserve through repeated artificial tips | `defend()` strictly reverts unless $\text{currentICR} < \text{triggerICR}$. Tips are hard-capped at $\le 100\text{ bps}$ by contract validation. Each call must strictly increase ICR. | Owner sets `triggerICR` excessively high without realizing.                         |
| **BTC Defense Reserve**     | Reentrant Contract            | Reentrancy during native BTC transfer / tip payment       | Theft of vault native BTC reserve balance                      | Vault applies OpenZeppelin `ReentrancyGuard` to all external entrypoints and strictly enforces Checks-Effects-Interactions (reserve state deducted before native transfer).            | Flaw in EVM call execution or compiler bug.                                         |
| **Trove Collateral**        | External Arbitrageur          | Oracle price manipulation (e.g. flash loan DEX pool skew) | Premature or distorted defense execution                       | Ballast uses Mezo's canonical on-chain `PriceFeed`, which reads from verified Chainlink-style oracle precompiles, NEVER a DEX spot AMM price.                                          | Failure, latency, or corruption of Mezo's canonical oracle.                         |
| **Keeper Gas Capital**      | Front-running MEV Searcher    | Front-running keeper `defend()` txs in mempool            | Keeper wastes gas; searcher captures tip                       | `defend()` is permissionless; anyone can call it. While the keeper loses the tip, the **user's trove is still successfully defended**.                                                 | Keeper disincentivization if MEV searchers capture tips on public testnets/mainnet. |
| **Trove Solvency**          | Hostile Validator / Sequencer | Keeper transaction censorship during market plunge        | Trove liquidated before defense tx confirms                    | Anyone can act as a keeper; transactions can be submitted via multiple RPC endpoints or directly to block proposers.                                                                   | 100% validator censorship or total network halt.                                    |
| **Residual Vault Tokens**   | Griefing Attacker             | Sending stray tokens or native BTC directly to vault      | State corruption or accounting distortion                      | Vault tracks `musdReserve` and `btcReserve` in explicit storage variables, NEVER via `address(this).balance` or `balanceOf(this)`.                                                     | Unclaimed stray tokens remain until owner calls `sweep()`.                          |
| **Trove Position**          | Uneducated User               | Misconfiguring `triggerICR` too close to 110% MCR         | Liquidation occurs before keeper can execute                   | Factory and vault validate $\text{triggerICR} \ge 112\%$. UI enforces recommended $> 115\%$ trigger with prominent warning dialogs.                                                    | Sudden BTC gap-down faster than block production.                                   |

---

## 3. Deep-Dive Security Analysis

### 3.1 Oracle Risk & Staleness

**Vector**: Oracle delay, stale price data, or oracle outage.

- **Protocol Ground Truth**: Mezo's `PriceFeed.sol` enforces:
  ```solidity
  require(block.timestamp - updatedAt <= 60, "PriceFeed: Oracle is stale.");
  ```
  If the oracle has not updated within 60 seconds, `fetchPrice()` **reverts**.
- **Impact on Ballast**:
  - When the oracle is stale, `checkDefense()` and `defend()` revert.
  - No defense transaction can execute at an outdated or fabricated price.
  - However, while the oracle is stale, Mezo's `TroveManager.liquidate()` also reverts because it calls `fetchPrice()`. Therefore, **a user cannot be liquidated on a stale oracle either**.
- **Mitigation**:
  - Ballast relies exclusively on Mezo's official protocol `PriceFeed` (matching `BorrowerOperations` and `TroveManager` exactly).
  - No secondary oracle or DEX spot price is used, completely eliminating flash-loan price manipulation vectors.

### 3.2 Keeper Censorship & Latency Risk

**Vector**: During severe market crashes (e.g., BTC dropping 15% in 5 minutes), network gas prices surge and mempools experience congestion. A keeper's transaction may sit pending while the market continues to fall.

- **Mitigation**:
  - `triggerICR` must be set with an adequate safety margin (e.g. 120-125% ICR vs 110% MCR).
  - The tip incentive (`maxTipBps`) provides economic motivation for keepers to bid higher priority gas fees (`maxPriorityFeePerGas`) to ensure immediate block inclusion.
  - The keeper bot architecture supports automatic dynamic gas bumping (EIP-1559 fee escalation).

### 3.3 MEV, Sandwiching & Front-Running

**Vector**: Searchers observe a keeper's `defend()` call in the public mempool and front-run it to capture the tip.

- **Impact Analysis**:
  - From the borrower's perspective, **protection is fulfilled regardless of who calls `defend()`**. The borrower pays the exact same tip (`maxTipBps`) whether Keeper A or Searcher B executes it.
  - From the keeper's perspective, tip sniping can cause lost gas.
- **Mitigation**:
  - The keeper script can optionally submit transactions via private RPC relayers (if supported on Mezo mainnet) or calibrate gas pricing appropriately.
  - In all scenarios, the vault's solvency invariant is preserved.

### 3.4 Reentrancy Attacks via Native BTC Refunds

**Vector**: In Mezo, collateral is native BTC. When `defend()` pays a BTC tip or when `withdrawColl` sends funds, an external call `call{value: ...}("")` is triggered. A malicious contract receiver could reenter `BallastVault`.

- **Mitigation**:
  1. **ReentrancyGuard**: All external state-changing functions in `BallastVault` are guarded by OpenZeppelin's `ReentrancyGuardUpgradeable` (`nonReentrant`).
  2. **Checks-Effects-Interactions (CEI)**: All internal reserve deductions (`btcReserve -= ...`) occur before any external low-level transfer.

### 3.5 Owner Key Compromise & Blast Radius

**Vector**: A user's private key is compromised.

- **Impact**: The attacker can withdraw defense reserves and close/adjust the user's trove.
- **Blast Radius**: Because each user has an isolated EIP-1167 proxy vault, **a compromised user key affects only that user's vault**. There is zero shared pool, zero cross-vault contamination, and zero protocol-wide vulnerability.

### 3.6 Smart Account Compatibility (Mezo Passport)

**Vector**: Mezo Passport utilizes smart account wallets (account abstraction). Contracts assuming `tx.origin == msg.sender` or utilizing Solidity `transfer()` (which restricts gas to 2300) break smart accounts.

- **Mitigation**:
  - Ballast NEVER uses `tx.origin`. All authentication relies strictly on `msg.sender`.
  - All native BTC transfers to the owner or keeper use `.call{value: ...}("")` with full remaining gas, allowing smart contract wallets to process incoming funds without out-of-gas errors.

---

## 4. The Limits of Protection

Ballast is an automated defense mechanism, not an absolute guarantee against liquidation. The UI, documentation, and user prompts must honestly communicate the **inherent limits of protection**:

1. **Reserve Exhaustion**:
   - If a market drawdown is deep enough that both `musdReserve` and `btcReserve` are depleted before reaching `targetICR`, Ballast executes a partial defense to raise ICR as high as possible. Once reserves hit 0, the trove is completely exposed to further price drops.
2. **Flash Gaps Beyond Keeper Latency**:
   - If Bitcoin's price gaps down instantaneously (e.g. from 125% ICR directly to 108% ICR in a single oracle round or block), the trove enters the liquidatable zone before any defense transaction can be mined.
3. **Network Halts or Hard Forks**:
   - If the underlying Mezo RPC or consensus layer stalls, off-chain keepers cannot submit transactions.
4. **Governed Minimum Net Debt Clamping**:
   - If debt repayment would leave remaining net debt under 1,800 MUSD, debt repayment is halted and protection relies entirely on the BTC reserve. If the user provided only MUSD reserves and zero BTC reserves, the vault cannot repay below the 1,800 MUSD threshold.

---

## 5. Security Checklist for Implementation

- [ ] All math operations use fixed-point `mulDiv` with explicit rounding direction.
- [ ] No raw balances used for internal reserve accounting.
- [ ] Non-reentrant on all state-changing external functions.
- [ ] Native BTC transfers checked for return success (`require(success)`).
- [ ] Full NatSpec comments on all functions and errors.
- [ ] Zero mock data or test doubles reachable in production bundles.
- [ ] Foundry fork tests validating price drops, partial defense, and liquidation immunity.
