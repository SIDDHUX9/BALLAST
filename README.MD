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

## Permissionless Defense & Manual Execution

Ballast is strictly non-custodial and permissionless. The protocol **does not depend on any centralized keeper infrastructure** or privileged roles. Any user or third party can defend any under-collateralized vault and earn the configured keeper tip.

### Manual Defense Tool (`scripts/defend-manually.ts`)

To defend any vault directly without running the keeper bot:

```bash
# Check vault status in dry-run mode (no transaction sent)
npx tsx scripts/defend-manually.ts --vault <VAULT_ADDRESS> --dry-run

# Execute defense on-chain and earn caller tip
npx tsx scripts/defend-manually.ts --vault <VAULT_ADDRESS> --key 0x<YOUR_PRIVATE_KEY>
```

The script:
1. Queries `checkDefense()` on the target vault.
2. Computes exact off-chain hints via `SortedTroves`.
3. Simulates the transaction with `eth_call`.
4. Submits the defense transaction and confirms the improved ICR and earned tips on-chain.

---

## Autonomous Keeper Bot (`apps/keeper`)

The repository includes a production-ready, autonomous keeper service:

```bash
# Run keeper in dry-run mode (indexes events, computes hints, simulates eth_calls)
pnpm --filter @ballast/keeper dev -- --dry-run

# Run keeper with altruistic mode (ignores profit margin for demos)
pnpm --filter @ballast/keeper dev -- --altruistic

# Run tests
pnpm --filter @ballast/keeper test
```

### Keeper Architecture:
- **Discovery**: Chunked indexing of `VaultCreated` events from deploy block with confirmation depth and SQLite cursor persistence.
- **Monitor Loop**: 15s interval batch multicalls to `checkDefense()`, with off-chain `SortedTroves` hints and `eth_call` simulations.
- **Profitability**: Defense transactions are only broadcast if expected tips cover estimated gas costs plus configurable profit margin (`--altruistic` bypasses margin).
- **Safety**: Circuit breaker after consecutive failures, low-balance keeper alerts, RPC failover list with health checks, per-vault cooldown, and pre-flight state re-checks.
- **Observability**: Fastify `/healthz` (RPC status, block age, cycle timestamps) and Prometheus text `/metrics`.

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