# Changelog

All notable changes to the **Ballast** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries are listed in reverse chronological order (newest first).

---

## [Unreleased]

### Added

- **Landing Page Pixel-Faithful Editorial Redesign**:
  - Rebuilt `/` in `apps/web` to pixel-faithfully match `design-reference/full-mockup.png` across all 6 sections (Hero, The Problem, How It Works, Interactive Simulator, Our Belief, Editorial Footer).
  - Extracted, masked, and optimized all artwork assets into `apps/web/public/assets/landing/` in modern WebP format with alpha transparency, cutting total image weight to ~593 KB (well below the 1.5 MB limit).
  - Moved `full-mockup.png` out of `public/` into `design-reference/full-mockup.png` to ensure reference mockups never ship in production builds.
  - Authored comprehensive element-to-asset inventory map in `docs/LANDING_ASSET_MAP.md`.
  - Color token calibration recorded in ADR-0004 (`docs/DECISIONS.md`), adding `--color-rust` (`#C1411C`) and exact sampled values for paper (`#F7EFE4`), ink (`#0A1521`), and ember (`#CA461E`).
  - Added reusable organic deckle torn-paper CSS clip paths (`.torn-edge-top`, `.torn-edge-bottom`, `.torn-edge-y`) and SVG `feTurbulence` paper texture grain.
  - Created reusable `<Handwritten />` component featuring Google Font script typography and organic inline SVG hand-drawn arrows and underline strokes.
  - Ensured all UI cards (Position Card, Interactive Simulator) are 100% real interactive React components with live SVG chart calculations, dynamic sliders, and timeframe tabs.
  - Implemented automated Playwright visual diff test suite (`scripts/landing-diff.ts`) capturing 1440px, 768px, and 390px viewports with side-by-side and pixelmatch overlay generation in `docs/landing-diff/`.
- Live deployment of Ballast core contracts to Mezo Testnet (Matsnet, Chain ID 31611) at block `16251639`:
  - `BallastVault` (Implementation): `0x815893bad1708a201eeeaf226eed576a7ffea4bc`
  - `BallastFactory`: `0x8d5b392839300b487addeecc35f5bc534111cd33`
  - Validated metadata committed to `deployments/matsnet.json` matching `DeploymentSchema`.
  - Exported typed ABIs to `packages/shared/abis/` and constants in `packages/shared/src/abis.ts` via `pnpm contracts:export`.
  - Generated standalone standard-json inputs for Blockscout in `deployments/`.
  - Authored `docs/DEPLOYMENT.md` with complete explorer links and operational guides.
  - Implemented and verified end-to-end live testnet smoke test (`scripts/smoke.ts` / `pnpm smoke`).
- Comprehensive Foundry Fork test suite for `packages/contracts` pinned to block `16250250` on Mezo Testnet (Matsnet, Chain ID 31611):

  - `BallastFactoryFork.t.sol`: Deterministic CREATE2 addresses, single-vault-per-owner mapping, reinitialization protection, implementation lock.
  - `BallastLifecycleFork.t.sol`: Complete trove operations (open, borrow more, add collateral, repay, withdraw collateral, close) executed against real deployed Mezo contracts.
  - `BallastRulesFork.t.sol`: Strict parameter validation (MCR margin $\ge 112\%$, target separation $\ge 500$ bps, caps at $250\%$ and $300\%$, tip cap $\le 100$ bps).
  - `BallastDefenseFork.t.sol`: Defense execution across ICR states, repay-only, collateral-only, mixed defense, partial reserve defense, minimum net debt (1,800 MUSD) clamping, inactive trove guards, oracle staleness/failure guards, and recovery mode mechanics.
  - `BallastTipFork.t.sol`: Verified keeper tip bounding by `maxTipBps`, accurate asset payout (MUSD on debt repayment, BTC on collateral top-up, dual tips on mixed defense), zero tip when `maxTipBps == 0`, and assertion that tips never exceed value moved.
  - `BallastPermissionsFork.t.sol`: Owner-only access control on all vault functions, permissionless `defend()`, and non-custodial reserve recovery.
  - `BallastSmartAccountFork.t.sol`: Integration test simulating a Mezo Passport Bitcoin smart account wallet as vault owner, verifying low-level native BTC transfer handling.
  - `BallastAttacksFork.t.sol`: Reentrancy attack resistance on `defend()` and BTC tip callbacks via `ReentrancyGuard`, reverting keeper handling, resistance to stray BTC/ERC20 accounting corruption, rule change front-running safety, and dust griefing rejection.
  - `BallastMathFuzz.t.sol`: Pure mathematical round-trip and boundary fuzz tests for `BallastMath` (ICR, target debt, repay deficit, collateral deficit, tip scaling, integer rounding bounds).
  - `BallastLiveVaultFuzz.t.sol`: Randomized fuzz tests against a live on-chain vault testing random rules, reserves, debt levels, and market drawdowns.
  - `test/invariants/`: Handler-based invariant test suite (`BallastHandler.sol`, `BallastInvariants.t.sol`) with ghost variables verifying all 5 core protocol invariants.
  - `BallastCoverageFork.t.sol`: Targeted boundary and branch tests reaching 100% constructor and modifier coverage, `claimCollateral()`, and token `sweep()`.
- Committed Foundry gas snapshot in `packages/contracts/.gas-snapshot`.

### Changed & Fixed

- **Reentrancy Hardening (CEI Pattern)**: Refactored `BallastVault.sol` to deduct tracked reserves (`musdReserve` and `btcReserve`) strictly *before* executing any external calls (`repayMUSD`, `addColl`, keeper tip transfers), resolving potential reentrancy attack vectors.
- **ERC20 Safety via SafeERC20**: Replaced manual boolean return checks on `musdToken` calls with OpenZeppelin `SafeERC20` (`safeTransfer`, `safeTransferFrom`, `forceApprove`), preventing silent transfer failures and eliminating dead unreachable branches.
- **Stack Too Deep Elimination**: Resolved EVM stack limits in legacy codegen by memory struct packing (`DefenseParams`, `DefenseResult` in `BallastMath`) and factoring helper query `_getDebtAndColl()`.
- **Quality Gate Compliance**:
  - `src/BallastFactory.sol`: 100.00% Line Coverage, 100.00% Branch Coverage
  - `src/BallastVault.sol`: 97.17% Line Coverage, 90.62% Branch Coverage
  - `src/libraries/BallastMath.sol`: 97.62% Line Coverage, 100.00% Branch Coverage
  - Slither: Zero medium or higher severity findings across the codebase.


- Scaffolding of production-ready pnpm workspaces monorepo:
  - `apps/web`: Next.js 15 App Router web application with strict TypeScript, Tailwind CSS, and zero-mock empty states.
  - `apps/keeper`: Fastify Node.js service with viem, pino, zod, and better-sqlite3.
  - `packages/contracts`: Foundry project targeting solc 0.8.24 with London EVM target, profiles, and linters.
  - `packages/shared`: Pure math library (mirroring Solidity formulas), brand constants with URLs, typed addresses, deployments loader, and zod schemas built with tsup.
- Configured ESLint 9 flat config, Prettier formatting, Vitest test runner, and TypeScript strict typechecks across all packages.
- Added GitHub Actions CI workflow (`.github/workflows/ci.yml`) including Rule 2 automated bundle cleanliness check (`scripts/check-clean-bundle.js`).
- Recorded ADR-0002 (Tooling Selection and EVM Target Version) in `docs/DECISIONS.md`.
- Completed Mezo MUSD protocol reconnaissance in `docs/PROTOCOL_NOTES.md` with exact code line references, delegation analysis, and live testnet verification.
- Recorded ADR-0001 (Per-User Minimal Proxy Vault-Owns-Trove Architecture) in `docs/DECISIONS.md`.
- Authored comprehensive technical specification in `docs/SPEC.md` covering factory and vault architecture, fixed-point formulas, edge cases, event schemas, and contract interfaces.
- Authored exhaustive threat model and security analysis in `docs/THREAT_MODEL.md` including oracle analysis, censorship, MEV, reentrancy, and limits of protection.
- Created `packages/shared/src/brand.ts` (single source of truth for branding) and `packages/shared/src/protocol.ts` (typed address map).
- Implemented `scripts/recon.ts` for live on-chain protocol querying and verification.
- Extracted official contract ABIs into `packages/shared/abis/` and minimal contract interfaces in `packages/contracts/src/interfaces/`.
- Created repository governance and non-negotiable engineering rules in `AGENTS.md` and Antigravity workspace rules (`.agents/rules/ballast.md`, `.agent/rules/ballast.md`).
- Initialized Architecture Decision Record (ADR) log and template in `docs/DECISIONS.md`.
- Initialized running project changelog in `docs/CHANGELOG.md`.
- Published comprehensive product brief and protocol mechanics in `docs/PROJECT_BRIEF.md`.
