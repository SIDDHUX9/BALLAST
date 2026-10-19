# Architecture Decision Records (ADR) Log

This document records architectural and technical decisions made for **Ballast**. All significant architectural choices, protocol integrations, and structural decisions must be documented here using the template below.

---

## Decision Log

| ID                                                                         | Title                                                                 | Status   | Date       | Decision Maker |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------- | -------- | ---------- | -------------- |
| [ADR-0001](#adr-0001-per-user-minimal-proxy-vault-owns-trove-architecture) | Per-User Minimal Proxy Vault-Owns-Trove Architecture                  | Accepted | 2026-10-19 | Lead Engineer  |
| [ADR-0002](#adr-0002-tooling-selection-and-evm-target-version)             | Tooling Selection (ESLint & Prettier) and EVM Target Version (London) | Accepted | 2026-10-19 | Lead Engineer  |
| [ADR-0003](#adr-0003-mezo-passport-rainbowkit-and-bitcoinevm-dual-architecture-wallet-integration) | Mezo Passport, RainbowKit, and Bitcoin/EVM Dual-Architecture Wallet Integration | Accepted | 2026-10-19 | Lead Engineer  |

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

## ADR-0003: Mezo Passport, RainbowKit, and Bitcoin/EVM Dual-Architecture Wallet Integration

### Status

Accepted

### Date

2026-10-19

### Context & Problem Statement

Ballast operates on Mezo Testnet (Matsnet, Chain ID 31611). Unlike typical EVM chains, Mezo features first-class Bitcoin wallet support. Users may connect with either:
1. **Bitcoin-native wallets** (e.g., UniSat, OKX, Xverse)
2. **EVM wallets** (e.g., MetaMask, Rabby, Coinbase Wallet, Rainbow, WalletConnect)

Through Mezo's Passport / OrangeKit infrastructure, Bitcoin wallets do not issue transactions directly from an EOA address. Instead, each Bitcoin wallet controls an ERC-4337 smart account on Mezo. The smart account validates the Bitcoin wallet's signature (via ECDSA/Schnorr validation on Mezo) and acts as the on-chain `msg.sender` for all interactions with the MUSD protocol and Ballast contracts.

We must support both wallet classes side-by-side with:
- Grouped wallet listings in the connection modal.
- A bespoke RainbowKit skin conforming to Ballast design tokens (paper, ink, hairline, 2-4px radii, no glow/neon).
- Chain detection, network switcher, and sticky warning banner for off-chain connections.
- Persistent SSR-safe sessions without hydration mismatches.
- A unified transaction execution abstraction (`useBallastWrite()`) handling differences between EVM `writeContract` and OrangeKit smart account relaying, with pre-flight simulation and revert decoding.
- Strict isolation of test connectors per Rule 2 (never shipping to production).

### Decision

#### 1. Pinned Package Versions

| Package | Pinned Version | Purpose |
| --- | --- | --- |
| `@mezo-org/passport` | `0.17.2` | Core Mezo Passport SDK and chain definitions |
| `@mezo-org/orangekit` | `1.0.0-beta.40` | Bitcoin wallet connectors and smart account relay |
| `@rainbow-me/rainbowkit` | `2.2.11` | Wallet modal and connector grouping UI |
| `wagmi` | `2.19.5` | React hooks and client state for EVM |
| `viem` | `2.21.57` | EVM primitive abstractions and ABI encoding |
| `@tanstack/react-query` | `5.104.4` | Async query cache and state management |

#### 2. Real Package Exports Verified from Installed Artifacts

Investigation of installed modules revealed differences from documentation drafts:
- **Testnet Chain Export**: The installed `@mezo-org/passport` package exports `mezoTestnet` (Chain ID `31611`, RPC `https://rpc.test.mezo.org`, Explorer `https://explorer.test.mezo.org`). Older documentation referenced names like `matsnetTestnetChain` and `mezoMatsnetTestnet`, which are not exported in `0.17.2`.
- **Exported Bitcoin Wallets**: `@mezo-org/passport` and `@mezo-org/orangekit` export connectors for:
  - `unisatWalletMezoTestnet` (UniSat Wallet)
  - `okxWalletMezoTestnet` (OKX Wallet)
  - `xverseWalletMezoTestnet` (Xverse Wallet)
- **Account Hooks**: `@mezo-org/passport` exports `useWalletAccount` (returning `accountAddress` [the Mezo smart account address], `walletAddress` [the Bitcoin signer address], `networkFamily`, and `connector`) and `useSendTransaction` for smart account relaying.

#### 3. Custom Skin & Wallet Grouping

We configured RainbowKit with `connectorsForWallets` split into two distinct groups:
1. **"Bitcoin wallets"**: UniSat, OKX, and Xverse (wrapped in SSR-safe connector factories).
2. **"EVM wallets"**: MetaMask, Rabby, Coinbase Wallet, Rainbow, and WalletConnect (`projectId` configured via `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`).

A bespoke RainbowKit theme (`ballastRainbowTheme`) replaces default styles with Ballast design tokens:
- Light theme: `#F4F1EA` paper background, `#14130F` ink text, 2px borders with hairline rgba, 4px radii, zero box shadows, zero glassmorphism blurs.
- Dark theme: `#0E0E0C` ground background, `#151512` surface, `#EDE9DF` text, hairline rgba borders.

#### 4. SSR-Safe Connector Initialization

`@mezo-org/orangekit` directly evaluates `window.unisat` and `window.okxwallet` during initialization. To prevent Next.js SSR hydration errors and Node runtime crashes, connectors are instantiated via SSR guards (`typeof window === 'undefined' ? [] : [...]`), while wagmi stores session state in `cookieStorage`.

#### 5. Unified Transaction Execution: `useBallastWrite()`

All contract write interactions in Ballast route through a single custom hook, `useBallastWrite()`:
- **Pre-flight Simulation**: Always runs `simulateContract` via `viem` / `publicClient` prior to prompting signatures. If the simulation reverts, it catches and decodes the error immediately without spending gas or sending a broken transaction.
- **Architecture Routing**:
  - If the active connector is an OrangeKit Bitcoin connector, it prepares the encoded calldata and dispatches through OrangeKit's smart account relay (`useSendTransaction`).
  - If the active connector is an EVM wallet, it dispatches via Wagmi's `writeContract`.
- **Typed Lifecycle States**: Transitions through `idle` $\to$ `simulating` $\to$ `awaiting_signature` $\to$ `submitted` $\to$ `confirmed` (or `failed`).
- **Human Revert Decoding**: `decodeContractError()` parses common MUSD and Ballast reverts (e.g. ICR < MCR, debt below 1,800 MUSD threshold, allowance insufficient, user cancellation) into plain-English feedback. Feature components never call Wagmi write hooks directly.

#### 6. Rule 2 Test Double Isolation

A burner-key connector (`test-connector.ts`) allows headless automated E2E tests when `NEXT_PUBLIC_E2E=1`. To satisfy Rule 2 (never shipping test doubles to production):
- Webpack `IgnorePlugin` in `next.config.mjs` completely strips `test-connector.ts` from production bundles when `NEXT_PUBLIC_E2E !== '1'`.
- A dedicated CI verification script (`scripts/check-clean-bundle.js`) scans the production build output for `E2E_BURNER_CONNECTOR_DO_NOT_SHIP_TO_PRODUCTION` and aborts if present.

### Consequences

#### Positive

- Complete, frictionless onboarding for both Bitcoin and EVM users.
- Consistent look-and-feel matching Ballast's editorial instrument aesthetic.
- Zero hydration errors and SSR crashes.
- Single source of truth for transaction execution with automated revert explanation.
- Full compliance with Rule 1 (no mock balances) and Rule 2 (no test doubles in production).

#### Negative / Trade-offs

- OrangeKit's smart account relay introduces an additional dependency on Mezo's relayer infrastructure for Bitcoin wallet transactions.
- Transitive dependencies (`@coinbase/cdp-sdk`, `@mezo-org/orangekit-contracts`) required Webpack ignore and transpile configuration in Next.js.

### Risks & Mitigations

- **Sender Address Confusion**: Users might expect their Bitcoin address to be `msg.sender`. The UI explicitly displays the smart account address as the active on-chain address and displays the Bitcoin address labeled as "Bitcoin Signer".
- **Wrong Network Submissions**: The UI detects mismatched chain IDs immediately and renders a blocking top banner with a one-click network switch, preventing transaction execution on unsupported chains.

### Verification

- Unit tests (`apps/web/tests/wallet-routing.test.ts`) validating connector routing, error decoding, and simulation failure handling.
- Next.js production build (`pnpm --filter @ballast/web build`) and clean bundle audit (`node scripts/check-clean-bundle.js`).
- Dev verification page at `/app/wallet-check` for real-time live chain diagnostics.

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
