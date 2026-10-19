# Changelog

All notable changes to the **Ballast** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Entries are listed in reverse chronological order (newest first).

---

## [Unreleased]

### Added
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

