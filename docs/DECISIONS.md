# Architecture Decision Records (ADR) Log

This document records architectural and technical decisions made for **Ballast**. All significant architectural choices, protocol integrations, and structural decisions must be documented here using the template below.

---

## Decision Log

| ID | Title | Status | Date | Decision Maker |
|---|---|---|---|---|
| [ADR-0001](#adr-0001-per-user-minimal-proxy-vault-owns-trove-architecture) | Per-User Minimal Proxy Vault-Owns-Trove Architecture | Accepted | 2026-10-19 | Lead Engineer |
| [ADR-0002](#adr-0002-tooling-selection-and-evm-target-version) | Tooling Selection (ESLint & Prettier) and EVM Target Version (London) | Accepted | 2026-10-19 | Lead Engineer |

---

## ADR-0002: Tooling Selection and EVM Target Version

### Status
Accepted

### Date
2026-10-19

### Context & Problem Statement
1. **Linter & Formatter**: Monorepo packages include Next.js (`apps/web`), a Fastify Node backend (`apps/keeper`), and shared libraries (`packages/shared`). We need unified, fast, and reliable linting and formatting across TypeScript, React, and configuration files.
2. **Solidity EVM Target**: Newer Solidity compilers (0.8.20+) default to the `shanghai` or `cancun` EVM, which generate the `PUSH0` opcode. If the target chain does not support `PUSH0`, contract deployment fails on-chain.

### Decision
1. **ESLint & Prettier**: We select ESLint (with `@typescript-eslint`) and Prettier rather than Biome. ESLint integrates natively with Next.js Core Web Vitals (`eslint-config-next`) and enables custom rule AST checks to enforce Rule 2 (verifying that no test double or burner key connector leaks into a production web bundle).
2. **Solidity EVM Version (London)**: Target `evm_version = "london"` with `solc = "0.8.24"` and `optimizer_runs = 200`. This matches Mezo's canonical MUSD protocol configuration (`vendor/musd/solidity/hardhat.config.ts`), guaranteeing compatibility and avoiding unsupported opcodes like `PUSH0` or `BLOBBASEFEE`.

### Consequences
- Reliable deployment on Mezo network without opcode incompatibility.
- Full tooling compatibility across Next.js, Node.js, and CI workflows.


---

## ADR-0001: Per-User Minimal Proxy Vault-Owns-Trove Architecture

### Status
Accepted

### Date
2026-10-19

### Context & Problem Statement
To provide automated liquidation and redemption protection on the Mezo network, an off-chain keeper must be able to deploy pre-funded reserves (MUSD debt repayment and/or BTC collateral top-up) when a borrower's Individual Collateral Ratio (ICR) drops below a safety threshold.

Our protocol reconnaissance of Mezo's `vendor/musd` contracts revealed that:
1. `BorrowerOperations.sol` (L796-802) strictly enforces `msg.sender == _borrower` for `openTrove`, `adjustTrove`, `addColl`, `repayMUSD`, and `closeTrove`. There is no operator approval registry (`approveOperator` or `setApprovalForAll`).
2. The only remote invocation contract, `BorrowerOperationsSignatures.sol`, uses EIP-712 typed signatures with strictly sequential nonces (`nonces[_borrower]++`). If a borrower pre-signs defense transactions, any manual user transaction or other signed operation invalidates the nonce, and pre-signed amounts cannot adapt to dynamic interest accrual or price swings.

### Decision
1. **Per-User Vault Architecture**: Deploy a dedicated `BallastVault` contract for each user via `BallastFactory`. The vault itself is the on-chain owner of the MUSD trove (`msg.sender` to `BorrowerOperations`).
2. **EIP-1167 Minimal Clones with CREATE2**: Use OpenZeppelin `Clones.cloneDeterministic` to deploy minimal proxies cheaply, with deterministic addresses derived from `keccak256(abi.encode(owner))`.
3. **Immutable Target Protocols**: Fix the verified Mezo MUSD contracts (`BorrowerOperations`, `TroveManager`, `PriceFeed`, `MUSD`) as immutables in the shared `BallastVault` implementation contract.
4. **Trustless & Autonomous Governance**: `BallastFactory` has no admin keys, no pause functions, no fee extraction mechanisms, and is non-upgradeable.
5. **Separate Tracked Reserves**: Track `musdReserve` and `btcReserve` explicitly in state storage, decoupling defense funds from raw balances so stray token transfers or external donations cannot manipulate state. Non-reserve tokens can be rescued by the owner via `sweep()`.
6. **Caller Tip Incentive**: Keepers are rewarded directly from the defense transaction via a bounded fee (`maxTipBps` $\le 100$ bps) on value moved.

### Consequences
#### Positive
- Enables completely permissionless, autonomous keeper defense without requiring pre-signed nonces or user presence during market crashes.
- Clean isolation of funds: each borrower's defense reserve is isolated in their own proxy; a flaw in one user's configuration cannot affect any other user's reserves or position.
- Minimal deployment gas cost (~45,000 gas per clone).
- Transparent, trustless design: no protocol owner can freeze funds, change logic, or extract fees.

#### Negative / Trade-offs
- Users must manage their trove through their `BallastVault` rather than interacting directly with Mezo's native UI contracts.
- An existing EOA-owned trove cannot be retroactively defended without closing or migrating it into a `BallastVault`.

### Risks & Mitigations
- **Native BTC Refunds**: When closing a trove or withdrawing collateral, Mezo's `ActivePool` and `CollSurplusPool` send native BTC via low-level `.call{value: ...}("")`. The `BallastVault` implements `receive() external payable` and automatically forwards refunds to the owner.
- **Min Net Debt Boundary**: In Mezo MUSD, debt cannot be reduced into the $(0, 1800\text{ MUSD})$ range. Defense formulas clamp repayments to preserve $\ge 1,800$ MUSD net debt or pivot to collateral additions.

### Verification
- Foundry fork tests validating factory clone prediction, proxy deployment, trove lifecycle through the vault, and keeper defense triggers under simulated oracle price drops.
- Static analysis (Slither) and zero-mock invariant testing.

---

## ADR Template

```markdown
# ADR-[NUMBER]: [SHORT TITLE]

## Status
[Draft | Proposed | Accepted | Rejected | Superseded by ADR-XXXX]

## Date
YYYY-MM-DD

## Context & Problem Statement
- What is the technical or product challenge we are addressing?
- What are the constraints, requirements, and assumptions?
- What on-chain or off-chain systems are affected?

## Decision
- What approach was chosen and why?
- What alternatives were evaluated, and why were they rejected?
- Reference official documentation, contracts, or research supporting this decision.

## Consequences
### Positive
- What benefits or guarantees does this decision provide?

### Negative / Trade-offs
- What liabilities, costs, complexity, or constraints are introduced?

### Risks & Mitigations
- What failure modes exist and how are they prevented or detected?

## Verification
- How will this decision be verified in tests (Foundry fork tests, static analysis, CI)?
```
