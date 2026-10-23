# Ballast — Liquidation Guardian for MUSD Troves

**Ballast** is an automated, non-custodial defense system that protects Bitcoin-backed MUSD troves on the Mezo network from liquidation and redemption by maintaining a pre-funded defense reserve.

When an individual collateral ratio (ICR) falls below a user-configured safety trigger, permissionless keepers deploy pre-funded MUSD debt repayment or native BTC collateral top-ups to restore the position to safety.

---

## Architecture & Monorepo Structure

This repository is managed with `pnpm` workspaces:

- `apps/web`: Next.js 15 App Router web application with strict TypeScript, Tailwind CSS, and Convex client.
- `apps/keeper`: Autonomous keeper core logic (`src/core`) with pure dependency injection (RPC client, wallet client, store interface).
- `convex/`: Serverless 24/7 backend running on Convex Free Tier:
  - `schema.ts`: Typed tables mirroring SQLite (`keeperState`, `vaults`, `snapshots`, `defenses`, `errors`, `linkTokens`, `telegramUsers`, `signatureNonces`, `alertStates`, `notificationOutbox`, `rateLimits`).
  - `crons.ts`: 30-second automated monitor loop (`crons.interval('monitor', { seconds: 30 })`) and hourly data pruning.
  - `keeper.ts`: Atomic compare-and-set lease coordination, batch commit, pending transaction receipt verification, and Node.js tick action.
  - `telegram.ts`: Ephemeral single-use link tokens, EIP-191 & ERC-1271 wallet signature authentication, rate limiting, and scheduled outbox worker with exponential backoff.
  - `http.ts`: `GET /healthz` and `POST /telegram/webhook` (with secret-token validation).
- `packages/contracts`: Foundry smart contract project (Solidity 0.8.24, London EVM target).
- `packages/shared`: Shared pure math library, protocol addresses, ABIs, brand constants, and Zod schemas.
- `docs/`: Technical specifications (`SPEC.md`), threat model (`THREAT_MODEL.md`), keeper budget arithmetic (`KEEPER_BUDGET.md`), decisions log (`DECISIONS.md`), and protocol notes (`PROTOCOL_NOTES.md`).
- `scripts/`: Operational and verification scripts, including `defend-manually.ts` and `set-webhook.ts`.

---

## Non-Negotiable Engineering Rules

This repository strictly follows the guidelines in [AGENTS.md](./AGENTS.md):
- **NO MOCKS in product code**: Every figure rendered comes from verified on-chain reads or pure mathematical calculations.
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

## Serverless 24/7 Keeper (`convex/`)

The keeper runs as a serverless background worker on Convex's free tier, requiring no always-on server:

- **Cadence**: 30s cron interval (`crons.interval('monitor', { seconds: 30 })`).
- **Atomic Lease**: Compare-and-set mutation on `keeperState` ensures overlapping cron ticks exit immediately and only one worker ever uses the keeper nonce.
- **Free-Tier Budget**: 25.9% function call quota (259,200 / 1,000,000 monthly calls) and < 1 MB storage footprint. See [docs/KEEPER_BUDGET.md](./docs/KEEPER_BUDGET.md) for full arithmetic.
- **Health Endpoint**: `GET https://<deployment>.convex.site/healthz` returns last tick age, vault count, circuit breaker status, and keeper balance with zero secrets exposed.
- **Telegram Webhook**: `POST https://<deployment>.convex.site/telegram/webhook` authenticated via `X-Telegram-Bot-Api-Secret-Token`.

```bash
# Start Convex development deployment
npx convex dev

# Execute a single keeper tick manually
npx convex run keeper:tick

# Register Telegram Webhook
npx tsx scripts/set-webhook.ts --url https://<deployment>.convex.site
```

---

## Quickstart & Verification

```bash
# Install workspace dependencies
pnpm install

# Build shared packages and apps
pnpm build

# Run unit tests, Anvil fork tests, and Convex tests
pnpm test

# Run TypeScript typechecks across all packages
pnpm typecheck

# Run linters
pnpm lint
```

---

## License

[MIT](./LICENSE)