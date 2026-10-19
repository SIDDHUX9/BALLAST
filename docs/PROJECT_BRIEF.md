# Project Brief: Ballast

## 1. Product Overview
**Ballast** is a production-grade decentralized application (dApp) built natively for the **Mezo network** to protect borrowers of the Bitcoin-backed **MUSD stablecoin**. 

In the MUSD protocol, borrowers open individual collateralized debt positions ("troves") by depositing BTC-backed collateral to mint MUSD. Ballast functions as an automated, non-custodial defense system: borrowers deposit a pre-funded defense reserve (collateral or MUSD debt repayment buffer) into a dedicated Ballast vault. When the borrower's Individual Collateral Ratio (ICR) drops below a user-configured safety trigger, permissionless off-chain keepers are incentivized to execute a defense transaction. This automatically injects collateral or repays debt to restore the trove to a safe ICR, preventing catastrophic liquidation or redemption.

---

## 2. Core Mezo Protocol Concepts

Ballast is engineered around two fundamental mechanics of Mezo's MUSD protocol:

1. **Liquidation Below 110% Individual Collateral Ratio (ICR)**
   - In Mezo MUSD, every trove must maintain an ICR above the Minimum Collateral Ratio (MCR) of 110% under normal operation.
   - If market volatility drives the collateral valuation down such that a trove's ICR falls below 110%, the trove is subject to immediate liquidation. During liquidation, the borrower's collateral is seized to close their debt, imposing a severe 100% loss of remaining equity and penalty fees.
   - **Ballast Defense**: Keepers trigger defensive re-collateralization or debt repayment well before ICR reaches 110% (e.g., at user-configured thresholds such as 125% or 130%), insulating the borrower from market wicks and network congestion.

2. **Redemptions Hitting the Lowest-ICR Troves First**
   - At any time, any MUSD holder can redeem MUSD tokens for underlying collateral at face value ($1 USD of collateral per 1 MUSD).
   - The protocol services redemptions strictly in ascending order of ICR: the troves with the lowest collateral ratios are redeemed first.
   - While redemption does not inflict a net economic penalty (debt is reduced proportionately to collateral taken), it involuntarily diminishes the borrower's Bitcoin upside and changes their net position.
   - **Ballast Defense**: By maintaining a borrower's ICR safely above the bottom tier of active troves, Ballast shields users from being selected as redemption targets.

---

## 3. Target Users

- **Bitcoin Holders Borrowing MUSD**: Long-term Bitcoin holders and DeFi participants on Mezo who leverage their BTC to mint MUSD stablecoins for liquidity, yield strategies, or operational expenses.
- **Risk-Averse Debtors**: Borrowers who cannot actively monitor their troves 24/7 or who face latency risks during sudden BTC price drawdowns, fear liquidation penalties, and want automated protection against involuntary redemptions.

---

## 4. Success Criteria

To achieve production readiness, Ballast must satisfy five core milestones:

1. **Deployed and Verified on Mezo Testnet**
   - Core smart contracts deployed, verified on the Mezo testnet block explorer, and linked directly to official Mezo MUSD contract interfaces.
2. **Real Wallet Flows**
   - Full end-to-end user experience supporting live Web3 wallet connection, trove discovery, defense reserve deposits/withdrawals, parameter configuration, and real transaction signing (zero mock balances or hardcoded sample data).
3. **Live Keeper**
   - A robust, autonomous keeper service continuously monitoring Mezo on-chain trove states, evaluating trigger conditions against current oracle prices, and executing defense transactions profitably and reliably.
4. **Real Alerts**
   - Live notification pipeline (e.g., Telegram, Discord, webhook, or email) alerting borrowers of ICR threshold warnings, defense triggers, reserve balance top-ups, and keeper executions.
5. **Public Repo**
   - Clean, well-documented, open-source repository with full test suites (Foundry fork tests, TypeScript strict checks), CI automation, deployment scripts, and comprehensive documentation.
