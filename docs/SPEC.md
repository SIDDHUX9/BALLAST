# Ballast Technical Specification

## 1. Overview & Architecture

**Ballast** is an autonomous, non-custodial liquidation and redemption guardian for Bitcoin-backed MUSD troves on the Mezo network. 

Because Mezo's `BorrowerOperations.sol` (lines 796-802) strictly enforces `msg.sender == _borrower` and provides no approved operator delegation mechanism, Ballast utilizes a **per-user vault architecture**:
- `BallastFactory`: An immutable, trustless factory that deploys one minimal proxy `BallastVault` per owner using EIP-1167 (via OpenZeppelin `Clones.cloneDeterministic` with CREATE2).
- `BallastVault`: A lightweight proxy contract owned by the borrower that serves as the on-chain owner of exactly one MUSD trove, stores two defense reserves (MUSD and native BTC), and permits permissionless keeper defense execution when pre-configured safety rules are met.

```
+-------------------------------------------------------------------+
|                           BallastFactory                          |
|  - cloneDeterministic(implementation, salt)                       |
|  - vaultOf(owner) -> deterministic address                        |
+-------------------------------------------------------------------+
                                  | deploys (CREATE2)
                                  v
+-------------------------------------------------------------------+
|                            BallastVault                           |
|  - Owner: Borrower (EOA or Mezo Passport Smart Account)           |
|  - State:                                                         |
|      * Rule (enabled, triggerICR, targetICR, maxTipBps)           |
|      * musdReserve (tracked explicitly)                           |
|      * btcReserve  (tracked explicitly)                           |
|                                                                   |
|  - Owner Operations:                                              |
|      * openTrove(), adjustTrove(), closeTrove()                   |
|      * setRule(), depositReserves(), withdrawReserves(), sweep()  |
|                                                                   |
|  - Permissionless Keeper Operation:                               |
|      * defend(upperHint, lowerHint)                               |
|      * checkDefense() [view]                                      |
+-------------------------------------------------------------------+
                                  |
              +-------------------+-------------------+
              |                                       |
              v (calls as msg.sender)                 v (oracle reads)
+------------------------------------+  +----------------------------+
|      Mezo BorrowerOperations       |  |       Mezo PriceFeed       |
|  - openTrove(), repayMUSD(),       |  |  - fetchPrice()            |
|    addColl(), closeTrove()         |  +----------------------------+
+------------------------------------+
```

---

## 2. Factory Contract: `BallastFactory`

### Responsibilities
1. Predict deterministic vault addresses for any owner address (`predictVault(address owner)`).
2. Deploy the user's `BallastVault` via `CREATE2` and initialize it with `owner`.
3. Track deployed vaults via `vaultOf(address owner)`.
4. Ensure strictly zero governance privileges: no admin, no pause, no fees, non-upgradeable.

### Salt Derivation
$$\text{salt} = \text{keccak256}(\text{abi.encode}(\text{owner}))$$

### Events
- `event VaultCreated(address indexed owner, address indexed vault);`

---

## 3. Vault Contract: `BallastVault`

### State & Storage Layout
Each `BallastVault` minimal proxy holds isolated user state:

```solidity
struct Rule {
    bool enabled;
    uint64 triggerICR;  // 1e18 precision (e.g., 1.20e18 = 120%)
    uint64 targetICR;   // 1e18 precision (e.g., 1.50e18 = 150%)
    uint16 maxTipBps;   // basis points (e.g., 50 = 0.50%, max 100 = 1.00%)
}

address public owner;
Rule public rule;

// Explicit tracked reserves (isolated from raw contract balances)
uint256 public musdReserve;
uint256 public btcReserve;
```

### Immutables in Implementation Contract
To eliminate SLOAD gas overhead, all Mezo protocol targets are defined as `immutable` in the shared `BallastVault` implementation:
- `IBorrowerOperationsMinimal public immutable borrowerOperations;`
- `ITroveManagerMinimal public immutable troveManager;`
- `IPriceFeedMinimal public immutable priceFeed;`
- `IMUSDMinimal public immutable musdToken;`
- `ISortedTrovesMinimal public immutable sortedTroves;`

---

## 4. Mathematical Formulas & Rounding Rules

All calculations use 18-decimal fixed-point arithmetic ($1e18 = 100\%$).

### 4.1 Individual Collateral Ratio (ICR)
$$\text{ICR} = \frac{\text{collateral} \times \text{price}}{\text{debt}}$$
- **Units**:
  - $\text{collateral}$: wei of native BTC ($10^{18}$ wei = 1 BTC).
  - $\text{price}$: wei of USD per BTC ($10^{18}$ wei = $1.00 USD).
  - $\text{debt}$: wei of MUSD ($10^{18}$ wei = 1 MUSD), obtained directly from `troveManager.getTroveDebt(address(this))` (includes accrued interest).
- **Rounding Rule**: When evaluating whether $\text{ICR} < \text{triggerICR}$, round **DOWN** ($\lfloor \dots \rfloor$). This is conservative and ensures protection triggers immediately if on the boundary.

### 4.2 Debt Repayment Needed to Reach Target ICR
To achieve $\text{targetICR}$ via debt reduction:
$$\text{targetDebt} = \left\lfloor \frac{\text{collateral} \times \text{price}}{\text{targetICR}} \right\rfloor$$
$$\text{idealRepay} = \begin{cases} \text{debt} - \text{targetDebt} & \text{if } \text{debt} > \text{targetDebt} \\ 0 & \text{otherwise} \end{cases}$$

- **Rounding Rule**: Round `idealRepay` **UP** ($\lceil \dots \rceil$) so that after repayment, the resulting ICR is strictly $\ge \text{targetICR}$.

### 4.3 Min Net Debt Boundary Clamping
In Mezo MUSD, net debt cannot fall in the range $(0, \text{minNetDebt})$ where $\text{minNetDebt} = 1,800\text{ MUSD}$.
Let $\text{netDebt} = \text{debt} - \text{MUSD\_GAS\_COMPENSATION}$.
1. If $\text{netDebt} \le \text{minNetDebt}$:
   - No debt repayment is permitted ($\text{musdToRepay} = 0$).
   - The entire defense must be executed via BTC collateral addition.
2. If $\text{netDebt} > \text{minNetDebt}$:
   - The maximum allowable repayment without triggering protocol revert is:
     $$\text{maxLegalRepay} = \text{netDebt} - \text{minNetDebt}$$
   - The actual repayment attempt is clamped by the available tracked reserve:
     $$\text{musdToRepay} = \min(\text{idealRepay}, \text{maxLegalRepay}, \text{musdReserve})$$

### 4.4 Collateral Addition Needed to Reach Target ICR
If debt repayment alone cannot reach $\text{targetICR}$ (e.g. MUSD reserve depleted, or clamped by `minNetDebt`):
Let $\text{remainingDebt} = \text{debt} - \text{musdToRepay}$.
$$\text{requiredCollateral} = \left\lceil \frac{\text{targetICR} \times \text{remainingDebt}}{\text{price}} \right\rceil$$
$$\text{idealBtcToAdd} = \begin{cases} \text{requiredCollateral} - \text{collateral} & \text{if } \text{requiredCollateral} > \text{collateral} \\ 0 & \text{otherwise} \end{cases}$$
$$\text{btcToAdd} = \min(\text{idealBtcToAdd}, \text{btcReserve})$$

- **Rounding Rule**: Round `requiredCollateral` **UP** ($\lceil \dots \rceil$) so the final ICR strictly satisfies $\ge \text{targetICR}$.

### 4.5 Keeper Tip Calculation
Keepers receive an incentive tip paid in the asset moved:
$$\text{musdTip} = \left\lfloor \frac{\text{musdToRepay} \times \text{maxTipBps}}{10000} \right\rfloor$$
$$\text{btcTip} = \left\lfloor \frac{\text{btcToAdd} \times \text{maxTipBps}}{10000} \right\rfloor$$
- **Rounding Rule**: Round tips **DOWN** ($\lfloor \dots \rfloor$) to ensure the tip never exceeds the owner's configured `maxTipBps` cap.
- **Tip Source**:
  - `musdTip` is deducted from available MUSD reserve or paid alongside the defense.
  - `btcTip` is paid from available BTC reserve directly to `msg.sender`.

---

## 5. Defense Logic & Execution Flow: `defend()`

```
Caller (Keeper)
      |
      | 1. defend(upperHint, lowerHint)
      v
[BallastVault]
      |-- Check: nonReentrant
      |-- Check: rule.enabled == true (revert: RuleDisabled)
      |-- Read: price = priceFeed.fetchPrice() (reverts if stale > 60s)
      |-- Read: coll, debt = troveManager.getEntireDebtAndColl(vault)
      |-- Check: trove is active (revert: TroveNotActive)
      |-- Calculate: currentICR
      |-- Check: currentICR < rule.triggerICR (revert: ICRNotDefendable)
      |
      |-- Calculate: musdToRepay, btcToAdd, musdTip, btcTip
      |-- Check: musdToRepay > 0 || btcToAdd > 0 (revert: InsufficientReserves)
      |
      |-- [Phase 1: Repay Debt]
      |   if musdToRepay > 0:
      |       musdReserve -= (musdToRepay + musdTip)
      |       musdToken.approve(BorrowerOperations, musdToRepay)
      |       BorrowerOperations.repayMUSD(musdToRepay, upperHint, lowerHint)
      |       musdToken.transfer(msg.sender, musdTip)
      |
      |-- [Phase 2: Add Collateral]
      |   if btcToAdd > 0:
      |       btcReserve -= (btcToAdd + btcTip)
      |       BorrowerOperations.addColl{value: btcToAdd}(upperHint, lowerHint)
      |       (bool success, ) = msg.sender.call{value: btcTip}("")
      |       require(success)
      |
      |-- [Phase 3: Post-Defense Invariant Verification]
      |   newICR = troveManager.getCurrentICR(vault, price)
      |   require(newICR > currentICR, "ICRDidNotImprove")
      |
      |-- Emit: Defended(vault, msg.sender, musdToRepay, btcToAdd, musdTip, btcTip, currentICR, newICR)
```

---

## 6. Validation Rules & Justification

### Rule Parameters
1. **`triggerICR`**:
   - **Protocol Constraint**: Mezo MCR is 110% (`1.10e18`).
   - **Safety Margin Justification**: Oracle heartbeat is 60 seconds (`MAX_PRICE_DELAY = 60`). During high-volatility Bitcoin drawdowns, BTC can drop 2-5% within seconds. A trigger set below 112% risks liquidation occurring before a keeper transaction confirms.
   - **Enforced Range**:
     $$1.12e18 \le \text{triggerICR} \le 2.50e18$$
2. **`targetICR`**:
   - Must provide meaningful separation from trigger:
     $$\text{targetICR} \ge \text{triggerICR} + 0.05e18 \quad (+500\text{ bps})$$
   - Capped at 300% (`3.00e18`) to prevent accidental excessive lockup of capital.
3. **`maxTipBps`**:
   - Enforced cap: $\le 100\text{ bps}$ (1.00%). Prevents keeper fee exploitation while maintaining strong economic incentive for keepers to execute.

---

## 7. Edge Cases & Protocol Interactions

| Edge Case | Protocol Condition | Vault Behavior |
|---|---|---|
| **Trove liquidated** | Status = `closedByLiquidation` | `defend()` and `checkDefense()` revert with `TroveNotActive`. Keeper ignores position. |
| **Trove redeemed fully** | Status = `closedByRedemption` | `defend()` reverts with `TroveNotActive`. Owner calls `claimCollateral()` through vault to recover surplus BTC. |
| **Trove redeemed partially** | ICR shifted dynamically | `checkDefense()` recalculates against latest reduced debt/collateral. Defense executes normally if ICR < trigger. |
| **Reserves empty** | `musdReserve == 0 && btcReserve == 0` | `checkDefense()` returns `defendable = false`. `defend()` reverts with `InsufficientReserves`. |
| **Reserves cover only part** | Partial defense | Partial defense executes. Post-defense check verifies $\text{newICR} > \text{oldICR}$. Reverts only if unable to improve ICR. |
| **Debt drops below minimum** | $\text{netDebt} - \text{repay} < 1800\text{ MUSD}$ | Repay amount is clamped to leave $\ge 1,800$ MUSD net debt. Deficit is satisfied via BTC reserve addition. |
| **Two keepers racing** | First tx defends position | Second tx reads $\text{currentICR} \ge \text{triggerICR}$ and cleanly reverts with `ICRNotDefendable`. |
| **Owner updates rule in same block** | `setRule()` called | Next tx in block evaluates new rule parameters. If disabled, defense reverts. |
| **Reentrancy via native BTC** | Keeper / owner fallback calls | All state changes precede external calls (Checks-Effects-Interactions) + OpenZeppelin `ReentrancyGuard`. |
| **Tip griefing** | Keeper calls repeatedly | Each call strictly requires $\text{ICR} < \text{triggerICR}$ and must raise ICR. Once defended, ICR is above trigger and cannot be called again until price drops. |
| **Smart contract owner (Mezo Passport)** | Owner is contract without EOA | All owner transfers use `.call{value: ...}("")` with 100k gas buffer. No `tx.origin` checks anywhere. |
| **Dust amounts** | Small residual shortfall | If required defense value is $< 1000$ wei, calculation clamps or handles gracefully without precision reversion. |

---

## 8. Event Schema

These events provide complete off-chain visibility for the keeper bot, UI dashboard, and Telegram alert pipeline:

```solidity
event VaultCreated(address indexed owner, address indexed vault);

event RuleSet(
    address indexed vault,
    bool enabled,
    uint64 triggerICR,
    uint64 targetICR,
    uint16 maxTipBps
);

event ReserveDeposited(
    address indexed vault,
    address indexed asset,
    uint256 amount,
    uint256 newReserve
);

event ReserveWithdrawn(
    address indexed vault,
    address indexed asset,
    uint256 amount,
    uint256 newReserve
);

event Defended(
    address indexed vault,
    address indexed keeper,
    uint256 musdRepaid,
    uint256 btcAdded,
    uint256 musdTip,
    uint256 btcTip,
    uint256 oldICR,
    uint256 newICR
);

event TroveOpened(address indexed vault, uint256 debtAmount, uint256 collAmount);
event TroveAdjusted(address indexed vault, uint256 collChange, uint256 debtChange, bool isDebtIncrease);
event TroveClosed(address indexed vault);
event CollateralClaimed(address indexed vault, uint256 amount);
event AssetSwept(address indexed vault, address indexed token, uint256 amount);
```

---

## 9. Public Contract API (Signatures Only)

### `IBallastFactory`
```solidity
interface IBallastFactory {
    event VaultCreated(address indexed owner, address indexed vault);

    function createVault() external returns (address vault);
    function predictVault(address owner) external view returns (address);
    function vaultOf(address owner) external view returns (address);
    function implementation() external view returns (address);
}
```

### `IBallastVault`
```solidity
interface IBallastVault {
    struct Rule {
        bool enabled;
        uint64 triggerICR;
        uint64 targetICR;
        uint16 maxTipBps;
    }

    // --- Configuration & Reserves (Owner Only) ---
    function initialize(address _owner) external;
    function setRule(bool enabled, uint64 triggerICR, uint64 targetICR, uint16 maxTipBps) external;
    function depositMUSD(uint256 amount) external;
    function depositBTC() external payable;
    function withdrawMUSD(uint256 amount) external;
    function withdrawBTC(uint256 amount) external;
    function sweep(address token) external;

    // --- Trove Management Wrappers (Owner Only) ---
    function openTrove(uint256 debtAmount, address upperHint, address lowerHint) external payable;
    function adjustTrove(uint256 collWithdrawal, uint256 debtChange, bool isDebtIncrease, address upperHint, address lowerHint) external payable;
    function closeTrove() external;
    function claimCollateral() external;

    // --- Keeper & Public Automation ---
    function defend(address upperHint, address lowerHint) external returns (uint256 musdRepaid, uint256 btcAdded);
    function checkDefense() external view returns (bool defendable, uint256 currentICR, uint256 musdToRepay, uint256 btcToAdd);

    // --- View State ---
    function owner() external view returns (address);
    function rule() external view returns (bool enabled, uint64 triggerICR, uint64 targetICR, uint16 maxTipBps);
    function musdReserve() external view returns (uint256);
    function btcReserve() external view returns (uint256);
}
```
