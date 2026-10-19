# Changelog

All notable changes to the **Ballast** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries are listed in reverse chronological order (newest first).

---

## [Unreleased]

### Added

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
