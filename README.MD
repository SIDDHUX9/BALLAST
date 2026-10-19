# Ballast — Liquidation Guardian for MUSD Troves

**Ballast** is an automated, non-custodial defense system that protects Bitcoin-backed MUSD troves on the Mezo network from liquidation and redemption by maintaining a pre-funded defense reserve.

When an individual collateral ratio (ICR) falls below a user-configured safety trigger, permissionless keepers deploy pre-funded MUSD debt repayment or native BTC collateral top-ups to restore the position to safety.

---

## Architecture & Monorepo Structure

This repository is managed with `pnpm` workspaces:

- `apps/web`: Next.js 15 App Router web application with strict TypeScript and Tailwind CSS.
- `apps/keeper`: Autonomous Node.js keeper bot built with Fastify, viem, pino, zod, and better-sqlite3.
- `packages/contracts`: Foundry smart contract project (Solidity 0.8.24, London EVM target).
- `packages/shared`: Shared pure math library, protocol addresses, ABIs, and Zod schemas.
- `docs/`: Technical specifications (`SPEC.md`), threat model (`THREAT_MODEL.md`), decisions log (`DECISIONS.md`), protocol notes (`PROTOCOL_NOTES.md`), and changelog (`CHANGELOG.md`).
- `scripts/`: Operational, verification, and reconnaissance scripts.

---

## Non-Negotiable Engineering Rules

This repository strictly follows the guidelines in [AGENTS.md](./AGENTS.md):
- **NO MOCKS in product code**: Every figure rendered comes from verified on-chain reads or mathematical calculations.
- **Test-only doubles isolated**: Test doubles must never ship to production. A dedicated CI check validates bundle cleanliness.
- **Derived protocol constants**: Interfaces and addresses are derived directly from Mezo's source repositories and verified via RPC.
- **Zero secrets**: Private keys come from keystores or environment managers; `.env.example` templates are maintained.
- **Strict TypeScript & Solidity**: `strict: true`, custom errors, NatSpec, and CEI enforced.

---

## Quickstart

```bash
# Install all workspace dependencies
pnpm install

# Build shared packages and apps
pnpm build

# Run unit tests across packages
pnpm test

# Run TypeScript typechecks
pnpm typecheck

# Run linters
pnpm lint
```

---

## License

[MIT](./LICENSE)