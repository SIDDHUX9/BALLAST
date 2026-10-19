# Protocol Reconnaissance: Mezo MUSD

This document contains ground-truth, verified protocol findings for Mezo's **MUSD** system derived directly from:
1. Solidity source code in `vendor/musd` (git submodule, commit reference).
2. Deployment artifacts in `vendor/musd/solidity/artifacts/deployments/matsnet`.
3. Live on-chain verification on Mezo Testnet ("Matsnet", Chain ID `31611`) via RPC `https://rpc.test.mezo.org`.

---

## 1. BorrowerOperations Analysis

**File**: `vendor/musd/solidity/contracts/BorrowerOperations.sol` (1,405 lines)  
**Interface**: `vendor/musd/solidity/contracts/interfaces/IBorrowerOperations.sol`

### External Function Signatures & Mutability

| Function Signature | Mutability | Payable? | Trove Owner Determination | Code Reference |
|---|---|---|---|---|
| `openTrove(uint256 _debtAmount, address _upperHint, address _lowerHint)` | `external payable` | **YES** | `msg.sender` | `BorrowerOperations.sol` L180-186 |
| `adjustTrove(uint256 _collWithdrawal, uint256 _debtChange, bool _isDebtIncrease, address _upperHint, address _lowerHint)` | `external payable` | **YES** | `msg.sender` | `BorrowerOperations.sol` L296-313 |
| `addColl(address _upperHint, address _lowerHint)` | `external payable` | **YES** | `msg.sender` | `BorrowerOperations.sol` L189-203 |
| `withdrawColl(uint256 _amount, address _upperHint, address _lowerHint)` | `external` | NO | `msg.sender` | `BorrowerOperations.sol` L225-240 |
| `withdrawMUSD(uint256 _amount, address _upperHint, address _lowerHint)` | `external` | NO | `msg.sender` | `BorrowerOperations.sol` L243-258 |
| `repayMUSD(uint256 _amount, address _upperHint, address _lowerHint)` | `external` | NO | `msg.sender` | `BorrowerOperations.sol` L261-276 |
| `closeTrove()` | `external` | NO | `msg.sender` | `BorrowerOperations.sol` L278-280 |
| `refinance(address _upperHint, address _lowerHint)` | `external` | NO | `msg.sender` | `BorrowerOperations.sol` L282-287 |
| `claimCollateral()` | `external` | NO | `msg.sender` | `BorrowerOperations.sol` L316-318 |
| `moveCollateralGainToTrove(address _borrower, address _upperHint, address _lowerHint)` | `external payable` | **YES** | `_borrower` (Caller MUST be StabilityPool) | `BorrowerOperations.sol` L206-222 |
| `restrictedOpenTrove(address _borrower, address _recipient, uint256 _debtAmount, address _upperHint, address _lowerHint)` | `external payable` | **YES** | `_borrower` (Caller MUST be `BorrowerOperationsSignatures`) | `BorrowerOperations.sol` L447-456 |
| `restrictedAdjustTrove(address _borrower, address _recipient, address _caller, uint256 _collWithdrawal, uint256 _mUSDChange, bool _isDebtIncrease, address _upperHint, address _lowerHint)` | `external payable` | **YES** | `_borrower` (Caller MUST be `BorrowerOperationsSignatures`) | `BorrowerOperations.sol` L476-497 |
| `restrictedCloseTrove(address _borrower, address _caller, address _recipient)` | `external` | NO | `_borrower` (Caller MUST be `BorrowerOperationsSignatures`) | `BorrowerOperations.sol` L458-465 |
| `restrictedRefinance(address _borrower, address _upperHint, address _lowerHint)` | `external` | NO | `_borrower` (Caller MUST be `BorrowerOperationsSignatures`) | `BorrowerOperations.sol` L467-474 |
| `restrictedClaimCollateral(address _borrower, address _recipient)` | `external` | NO | `_borrower` (Caller MUST be `BorrowerOperationsSignatures`) | `BorrowerOperations.sol` L439-445 |

### How Trove Ownership is Determined

In every standard borrower operation (`openTrove`, `adjustTrove`, `addColl`, `repayMUSD`, `withdrawColl`, `withdrawMUSD`, `closeTrove`, `refinance`), the trove owner is strictly hardcoded to `msg.sender`:
```solidity
// BorrowerOperations.sol lines 184-186
function openTrove(uint256 _debtAmount, address _upperHint, address _lowerHint) external payable override {
    _openTrove(msg.sender, msg.sender, _debtAmount, _upperHint, _lowerHint);
}

// BorrowerOperations.sol lines 192-202
function addColl(address _upperHint, address _lowerHint) external payable override {
    _adjustTrove(msg.sender, msg.sender, msg.sender, 0, 0, false, _upperHint, _lowerHint);
}
```

---

## 2. Delegation Analysis

### Can a Third Party Act on a User's Trove?

**Rigorously: NO, not without a freshly signed EIP-712 signature for each specific execution.**

In `BorrowerOperations.sol`, lines 796-802 strictly guard trove adjustments:
```solidity
/*
 * Confirm the operation is either a borrower adjusting their own trove (either directly or through
 * a signature), or a pure collateral transfer from the Stability Pool to a trove
 */
assert(
    msg.sender == _borrower ||
        (msg.sender == stabilityPoolAddress &&
            msg.value > 0 &&
            _mUSDChange == 0) ||
        msg.sender == borrowerOperationsSignaturesAddress
);
```

The only alternative entrypoint is `BorrowerOperationsSignatures.sol`:
- `addCollWithSignature(...)` (L269-301)
- `adjustTroveWithSignature(...)` (L330-377)
- `repayMUSDWithSignature(...)` (L503-537)
- `closeTroveWithSignature(...)` (L303-328)

However, `BorrowerOperationsSignatures` enforces:
1. **Sequential Nonces**: `mapping(address => uint256) private nonces` (`BorrowerOperationsSignatures.sol` L141, L626). Each signature consumes `nonces[_borrower]++`.
2. **Strict Expiry & Replay**: Signatures require `block.timestamp <= deadline` and commit to exact parameters (`assetAmount`, `debtChange`, `nonce`, `deadline`).
3. **No Operator Approvals**: There is no `setApprovalForAll`, `approveOperator`, or allowance-based delegation anywhere in Mezo's MUSD contracts.

### Trust & Feasibility Implications for Keepers
If an automated keeper were to rely on `BorrowerOperationsSignatures`:
- The user would have to pre-sign transactions for specific debt/collateral amounts.
- If the user touches their trove or performs *any* signed action, the nonce increments, invalidating all pre-signed defense signatures.
- If the required defense amount changes (due to BTC price movement or interest accrual), a pre-signed signature with a fixed amount either under-defends or fails.
- Therefore, off-chain pre-signed signatures are unusable for autonomous, dynamic keeper defense.

### Architectural Conclusion
Because native delegation does not exist, **the per-user vault-owns-trove pattern is strictly required**. Each borrower deploys a `BallastVault`, and that vault contract acts as `msg.sender` to `BorrowerOperations`.

---

## 3. TroveManager Views & State

**File**: `vendor/musd/solidity/contracts/TroveManager.sol` (1,671 lines)  
**Interface**: `vendor/musd/solidity/contracts/interfaces/ITroveManager.sol`

### Trove Status Enum
`ITroveManager.sol` L10-16:
```solidity
enum Status {
    nonExistent,         // 0
    active,              // 1
    closedByOwner,       // 2
    closedByLiquidation, // 3
    closedByRedemption   // 4
}
```

### Views & Debt Queries
1. **`getCurrentICR(address _borrower, uint256 _price)`** (`TroveManager.sol` L736-750):
   - Computes current Individual Collateral Ratio in 1e18 precision ($1e18 = 100\%$).
   - Calls `_getCurrentTroveAmounts(_borrower)`, which includes:
     - Recorded collateral + `getPendingCollateral(_borrower)` (redistributed rewards).
     - Recorded principal + recorded interest owed + unrecorded interest accrued up to `block.timestamp` + pending redistributed debt rewards.
2. **`getTroveDebt(address _borrower)`** (`TroveManager.sol` L591-595):
   - Calls `_getTotalDebt(_borrower)` (`TroveManager.sol` L1513-1527), which calculates:
     $$\text{totalDebt} = \text{principal} + \text{interestOwed} + \text{InterestRateMath.calculateInterestOwed}(\text{principal}, \text{rate}, \text{lastUpdate}, \text{block.timestamp})$$
   - Returns the **complete debt including interest accrued up to the current block timestamp** (excluding pending redistribution debt).
3. **`getEntireDebtAndColl(address _borrower)`** (`TroveManager.sol` L767-802):
   - Returns 6 values: `(coll, principal, interest, pendingCollateral, pendingPrincipal, pendingInterest)`.
   - `interest` includes accrued interest up to `block.timestamp`.
   - Total effective debt $= \text{principal} + \text{interest} + \text{pendingPrincipal} + \text{pendingInterest}$.
   - Total effective collateral $= \text{coll} + \text{pendingCollateral}$.

---

## 4. PriceFeed Specification

**File**: `vendor/musd/solidity/contracts/PriceFeed.sol` (77 lines)  
**Interface**: `vendor/musd/solidity/contracts/interfaces/IPriceFeed.sol`

- **Interface**: `function fetchPrice() external view returns (uint256);`
- **Target Precision**: 18 decimals (`TARGET_DIGITS = 18`, L12). Oracle price is scaled via `_scalePriceByDigits`.
- **Staleness Condition**:
  ```solidity
  // PriceFeed.sol lines 51-54
  require(block.timestamp - updatedAt <= MAX_PRICE_DELAY, "PriceFeed: Oracle is stale.");
  ```
  `MAX_PRICE_DELAY` is **60 seconds** (L14). If the underlying oracle has not pushed an update in $> 60$ seconds, `fetchPrice()` **reverts**.
- **Failure Behavior**: `fetchPrice()` has **no fallback and does not return 0**. Any failure (aggregator revert, price $\le 0$, or staleness $> 60$s) causes an immediate **revert**. Consequently, any transaction calling `openTrove`, `adjustTrove`, `defend`, or `checkDefense` will revert when the oracle is stale.

---

## 5. HintHelpers and SortedTroves

**Files**: `vendor/musd/solidity/contracts/HintHelpers.sol`, `vendor/musd/solidity/contracts/SortedTroves.sol`

### NICR Ordering
Troves are stored in `SortedTroves` ordered descending by Nominal Individual Collateral Ratio:
$$\text{NICR} = \frac{\text{collateral} \times 1e20}{\text{debt}}$$

### Off-Chain Hint Computation
1. Compute `NICR = (coll * 1e20) / debt`.
2. Call `HintHelpers.getApproxHint(NICR, numTrials, randomSeed)` to obtain an approximate address $O(\sqrt{N})$ positions away.
3. Call `SortedTroves.findInsertPosition(NICR, approxAddress, approxAddress)` to get the exact `(upperHint, lowerHint)`.

### Zero-Address Hints Behavior
`SortedTroves.sol` lines 440-442:
```solidity
if (prevId == address(0) && nextId == address(0)) {
    // No hint - descend list starting from head
    return _descendList(_troveManager, _NICR, data.head);
}
```
If `upperHint = address(0)` and `lowerHint = address(0)`:
- `SortedTroves` will linearly scan from the list head down to find the correct insertion point.
- **For small trove sets (such as on testnet with 258 troves), zero hints succeed on-chain** but consume more gas ($O(N)$ SLOADs).
- For production, calculating hints off-chain avoids gas waste and potential out-of-gas limits.

---

## 6. System Constants & Governance Rules

| Parameter | Value | Precision | Configurable? | Reference |
|---|---|---|---|---|
| **MCR** | 110% (`1.1e18`) | 1e18 | Constant | `LiquityBase.sol` L22 |
| **CCR** | 150% (`1.5e18`) | 1e18 | Constant | `LiquityBase.sol` L25 |
| **Gas Compensation** | 200 MUSD (`200e18`) | 1e18 | Constant | `LiquityBase.sol` L28 |
| **Min Net Debt** | 1,800 MUSD (`1800e18`) | 1e18 | Governable ($\ge 50$ MUSD) | `BorrowerOperations.sol` L97, L144 |
| **Borrowing Rate** | 0.1% (`1e15` = 0.001e18) | 1e18 | Governable | `BorrowerOperations.sol` L146 |
| **Redemption Rate** | Dynamically governed | 1e18 | Governable | `BorrowerOperations.sol` L129 |
| **Refinancing Fee** | 20% of borrowing fee | Percent | Governable | `BorrowerOperations.sol` L143 |
| **Interest Rate Model** | Fixed per trove upon open | Basis points | Governable globally | `InterestRateManager.sol` L88 |

### Interest Rate Accrual Mechanics
- When a trove is opened, its `interestRate` is set to `interestRateManager.interestRate()` (e.g., 100 bps = 1.00% APR).
- This rate is **fixed for the life of the trove** unless the owner calls `refinance()`.
- Interest accrues per-second on the principal:
  $$\text{interest} = \frac{\Delta t \times \text{principal} \times \text{interestRate}}{10000 \times 31536000}$$

### Recovery Mode Rules (`TCR < CCR = 150%`)
In `BorrowerOperations.sol` L1257-1275:
- **No collateral withdrawals** permitted (`_requireNoCollWithdrawal`).
- Pure collateral top-up is permitted.
- Pure debt repayment is permitted.
- Debt increase is ONLY permitted if accompanied by a collateral top-up such that $\text{newICR} \ge \text{CCR} (150\%)$ and $\text{newICR} > \text{oldICR}$.

---

## 7. Lifecycle Transitions: Liquidation & Redemption

### Liquidation (`ICR < 110%`)
- **Action**: Any user calls `TroveManager.liquidate(borrower)` or `batchLiquidateTroves(borrowers)`.
- **Trove Status**: Set to `Status.closedByLiquidation` (`TroveManager.sol` L1101).
- **Collateral Distribution**:
  - $0.5\%$ collateral compensation sent to liquidator caller (`_getCollGasCompensation`).
  - 200 MUSD gas compensation burned from GasPool to reward liquidator.
  - Remaining collateral and debt offset against Stability Pool MUSD deposits; any shortfall redistributed to surviving troves.
- **Events Emitted**:
  - `event TroveLiquidated(address indexed _borrower, uint256 _debt, uint256 _coll, uint8 operation)` (`operation = 0`)
  - `event TroveUpdated(address indexed _borrower, 0, 0, 0, 0, 0, 0, uint8 operation)`
  - `event Liquidation(...)`

### Partial Redemption (Lowest ICR Troves First)
- **Action**: MUSD holder calls `TroveManager.redeemCollateral(amount, ...)`.
- **Trove Status**: Remains `Status.active`.
- **Debt & Collateral**: Debt reduced by redeemed MUSD; collateral reduced by equivalent USD value ($\text{collDrawn} = \frac{\text{mUSDLot} \times 1e18}{\text{price}}$).
- **Reinsertion**: Trove reinserted in `sortedTroves` at `newNICR`.
- **Events Emitted**:
  - `event TroveUpdated(address indexed _borrower, principal, interest, coll, stake, rate, time, uint8 operation)` (`operation = 1`)

### Full Redemption
- **Action**: Redemption clears entire net debt down to `MUSD_GAS_COMPENSATION` (200 MUSD).
- **Trove Status**: Set to `Status.closedByRedemption` (`TroveManager.sol` L1261).
- **Surplus Collateral**: Remaining collateral moved to `CollSurplusPool`, claimable by borrower via `claimCollateral()` (`TroveManager.sol` L1193-1200).
- **Events Emitted**:
  - `event TroveUpdated(address indexed _borrower, 0, 0, 0, 0, 0, 0, uint8 operation)`
  - `event Redemption(...)`

---

## 8. Smart Contract Trove Ownership & MUSD Decimals

1. **Smart Contracts as Trove Owners**:
   - Yes, a smart contract can own a trove.
   - **Crucial Requirement**: The contract MUST implement `receive() external payable` or `fallback() external payable`.
   - **Reason**: When collateral is returned upon `withdrawColl`, `closeTrove`, or surplus refund, `ActivePool` and `CollSurplusPool` invoke:
     ```solidity
     // SendCollateral.sol L11-12
     (bool success, ) = _recipient.call{value: _amount}("");
     require(success, "Sending BTC failed");
     ```
     If the contract cannot receive native BTC, the call reverts, locking collateral.
2. **MUSD Token Decimals**:
   - `MUSD.sol` inherits OpenZeppelin ERC20 (`ERC20("Mezo USD", "MUSD")`).
   - Decimals: **18** (verified on-chain: `decimals() == 18`).

---

## 9. Live On-Chain Verified Facts (Mezo Testnet / Matsnet)

Verified via `scripts/recon.ts` against RPC `https://rpc.test.mezo.org` at block timestamp:
- **Chain ID**: `31611` (`0x7b7b`)
- **MUSD Address**: `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` (Decimals: `18`, Name: `Mezo USD`, Symbol: `MUSD`)
- **TroveManager Address**: `0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0`
- **BorrowerOperations Address**: `0xCdF7028ceAB81fA0C6971208e83fa7872994beE5`
- **PriceFeed Address**: `0x86bCF0841622a5dAC14A313a15f96A95421b9366`
- **SortedTroves Address**: `0x722E4D24FD6Ff8b0AC679450F3D91294607268fA`
- **StabilityPool Address**: `0x1CCA7E410eE41739792eA0A24e00349Dd247680e`
- **BorrowerOperationsSignatures Address**: `0xD757e3646AF370b15f32EB557F0F8380Df7D639e`
- **Active Troves in System**: 258
- **Live BTC Oracle Price**: ~$82,160.91 USD (`82160907340000000000000` wei)
- **MCR**: `110%`
- **CCR**: `150%`
- **Min Net Debt**: `1,800 MUSD`
- **Gas Compensation**: `200 MUSD`
- **Borrowing Rate**: `0.10%`
- **System TCR**: ~`295.22%`
- **Recovery Mode**: `Inactive` (Normal Mode)

---

## 10. Architecture Implication

### Core Architectural Decision: The Per-User Vault Pattern
Can a third-party keeper repay or add collateral to a user's trove natively?
- **No**. As proven by `BorrowerOperations.sol` line 796, caller validation strictly requires `msg.sender == _borrower`.
- The only delegated execution mechanism requires per-operation EIP-712 ECDSA signatures with sequential nonces, which cannot support uncoordinated autonomous keepers.
- **Therefore, Ballast MUST implement the per-user vault-owns-trove pattern (`BallastVault`)**:
  1. The user deploys their own `BallastVault` via `BallastFactory`.
  2. The `BallastVault` contract is the on-chain borrower and owner of the trove.
  3. The user deposits defense reserves (MUSD and/or native BTC) into their `BallastVault`.
  4. When ICR drops below the user's trigger, any permissionless keeper can invoke `BallastVault.defend()`.
  5. `BallastVault` executes `repayMUSD` or `addColl` as `msg.sender` to `BorrowerOperations`, deploying the reserves and restoring the ICR to the safety target.

---

## 11. Proposed Mezo Discord Community Question (Draft Only)

```text
Hi Mezo team! Quick question regarding MUSD trove management automation:
In the current BorrowerOperations contract, external adjustment functions (addColl, repayMUSD, adjustTrove) strictly enforce msg.sender == _borrower, and the signature path requires sequential nonces. Is there any existing or roadmap-planned native operator/delegation interface that allows an approved third-party or automation contract to repay debt / top-up collateral on behalf of an existing EOA-owned trove? Or is deploying a custom proxy/vault contract that owns the trove the officially recommended pattern for building automated liquidation-protection tooling on Mezo? Thanks!
```
