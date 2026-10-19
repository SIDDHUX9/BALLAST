# Ballast — Agent & Engineering Guidelines

This repository contains **Ballast**, a production-quality dApp for the Mezo network (Bitcoin-backed MUSD stablecoin). Ballast enables borrowers to protect their MUSD trove from liquidation and redemption by maintaining a pre-funded defense reserve that a permissionless keeper can deploy when the individual collateral ratio (ICR) drops below a user-configured trigger.

All AI coding assistants, subagents, and human contributors must adhere strictly to these non-negotiable rules.

---

## Non-Negotiable Engineering Rules

1. **NO MOCKS in Product Code**
   - Strictly no fake balances, fake positions, fake transactions, placeholder metrics, lorem ipsum, invented testimonials/logos/statistics, or hardcoded sample data rendered as if real.
   - Every number shown in the UI must originate directly from an on-chain read, an indexed event, or a pure mathematical calculation derived from those verified sources.
   - If data is unavailable, unreachable, or loading, the UI must render an honest empty state, loading skeleton, or explicit error state. Never paper over missing data with mock figures.

2. **Test-Only Doubles Isolated to Test Code**
   - Test-only doubles (e.g., `vm.mockCall` in Foundry fork tests, burner-key connectors enabled strictly under `NEXT_PUBLIC_E2E=1`) are permissible **only** inside test suites and test harnesses.
   - Test doubles must never ship in or leak into a production build.
   - A dedicated CI check must verify and fail if any E2E connector, testing harness, or mock artifact is reachable in a production bundle.

3. **Ground Truth Protocol Interfaces & RPC Verification**
   - Never rely on memory or assumptions for protocol interfaces, contract addresses, chain IDs, or token decimals.
   - Derive all parameters directly from official sources ([github.com/mezo-org/musd](https://github.com/mezo-org/musd), [mezo.org/docs/developers](https://mezo.org/docs/developers)).
   - Always verify addresses and bytecode on-chain via the target network RPC.
   - Cite the exact source file, commit hash, or deployed transaction hash in documentation and code comments.

4. **Zero Secret Leaks & Keystore Management**
   - Never commit private keys, API secrets, mnemonics, or production credentials to the repository.
   - Private keys must come from encrypted Foundry keystores, secure environment variables, or dedicated secret managers.
   - Maintain `.env.example` continuously updated with all required configuration variables (with dummy/placeholder formats, never actual credentials).

5. **Strict TypeScript & Robust Solidity Standards**
   - **TypeScript**: Strict mode enabled (`tsconfig.json` `strict: true`). No usage of `any` without an explicit, justifying comment.
   - **Solidity**: Version 0.8.x; use custom errors (no bare `require` strings); complete NatSpec on every external/public function; enforce the Checks-Effects-Interactions (CEI) pattern; apply `ReentrancyGuard` on all state-changing external functions.

6. **Honest Execution & Verification Reporting**
   - Every completed task, PR, or handoff must conclude with:
     - A list of exact commands executed.
     - A summary of their real output.
     - What could not be verified (and why).
     - Any open questions or blockers.
   - Never claim something works or compiles unless you have personally executed the verification command and observed the result.

7. **Clean Git Workflow & Conventional Commits**
   - Maintain small, focused, conventional commits (`feat`, `fix`, `test`, `docs`, `chore`) after each logical unit of work.
   - Do not bundle unrelated changes together.

8. **Human Escalation Protocol (`ASK ME:`)**
   - When blocked on actions that strictly require human intervention (such as requesting faucet funds, obtaining third-party API tokens, confirming browser extension wallet popups/signatures, or provisioning external accounts), **STOP immediately**.
   - Output `ASK ME:` followed by the exact step-by-step instructions and the exact values or responses needed back.

9. **Single Source of Truth for Branding**
   - The brand name, tagline, and official brand copy must live in exactly one file: `packages/shared/src/brand.ts`.
   - Never hardcode the brand name or tagline anywhere else across smart contracts, frontends, or keeper scripts. Import it from the shared package.
