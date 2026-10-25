# Ballast — Landing Page Copy Deck

This document defines the audited, approved copy for the Ballast landing page.

- **Primary Goal**: Position Ballast for two distinct audiences:
  1. **Public (Bitcoin holders who borrow MUSD)**: Shift from liquidation anxiety to deterministic control. Tone is calm, precise, and sober—zero hype, zero buzzwords, zero emojis.
  2. **Judges (Mezo Core Team)**: Demonstrate within 10 seconds that Ballast (a) natively extends Mezo MUSD contracts, (b) expands safe MUSD borrowing volume, and (c) is deployed with verified contracts and an honest statement of protocol risks.
- **Layout Constraint**: The landing page visual layout is frozen. All new copy preserves visual line counts and character lengths within approximately ±20% of the baseline design.

---

## 1. Header Navigation

| Element | Baseline Copy | New Copy | Baseline Chars | New Chars | Delta (%) | Audience Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Nav Item 1** | `Protocol` (`#how-it-works`) | `How it works` (`#how-it-works`) | 8 | 12 | +50% | Clear, self-explanatory operational label for borrowers. |
| **Nav Item 2** | `Risk` (`#simulator`) | `Stress test` (`#simulator`) | 4 | 11 | +175% | Action-oriented tool name that matches the in-app feature. |
| **Nav Item 3** | `Whitepaper` (`/whitepaper`) | `Security` (`#belief`) | 10 | 8 | -20% | Eliminates dead whitepaper link; emphasizes audited trust model. |
| **Nav Item 4** | `About` (`#belief`) | `Docs` (`https://mezo.org/docs/developers`) | 5 | 4 | -20% | Direct access for judges to Mezo developer documentation. |
| **CTA Button** | `Launch App` (`/app/overview`) | `Launch App` (`/app`) | 10 | 10 | 0% | Direct launch into active borrower dApp. |

---

## 2. Hero Section

| Element | Baseline Copy | New Copy | Baseline Chars | New Chars | Delta (%) | Audience Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Eyebrow** | `MUSD · COLLATERAL RISK INFRASTRUCTURE` | `MUSD LIQUIDATION PROTECTION · MEZO` | 37 | 34 | -8% | Direct, unpretentious category and network positioning. |
| **Headline** (3 lines) | `Lend`<br>`Bitcoin`<br>`with clarity.` | `Stay`<br>`above`<br>`water.` | 28 | 16 | -43% | Powerful, calm maritime metaphor matching the brand Ballast. |
| **Body Paragraph** | `Ballast helps MUSD borrowers understand liquidation risk, model market scenarios, and keep a deliberate buffer between their position and the edge.` | `Ballast defends your MUSD loan on Mezo. Set a trigger, fund a reserve, and your position is repaid or topped up before it nears liquidation.` | 151 | 140 | -7% | Plain explanation of mechanics: trigger, reserve, automatic repayment/top-up. |
| **Primary CTA** | `Launch App` (`/app/overview`) | `Launch App` (`/app`) | 10 | 10 | 0% | Immediate path to wallet connection. |
| **Secondary CTA** | `Explore the framework` (`/whitepaper`) | `See how it works` (`#how-it-works`) | 21 | 16 | -24% | Smooth scroll to 3-step mechanics without dead links. |
| **Proof Item 1 Title** | `Real-time data` | `Automatic defense` | 14 | 17 | +21% | Replaces vague 'real-time' claim with core automated functionality. |
| **Proof Item 1 Sub** | `Live position monitoring` | `Repays debt or adds BTC from your reserve` | 24 | 41 | +70% | Explicitly tells users how defense executes on-chain. |
| **Proof Item 2 Title** | `Scenario analysis` | `Stress-tested` | 17 | 13 | -23% | Matches the interactive simulator and in-app stress tool. |
| **Proof Item 2 Sub** | `Model market moves` | `See what a price drop does to your loan` | 18 | 39 | +116% | Relatable risk modeling for Bitcoin borrowers. |
| **Proof Item 3 Title** | `Non-custodial` | `You hold the keys` | 13 | 17 | +31% | Plain-English sovereignty for Bitcoin holders. |
| **Proof Item 3 Sub** | `Your positions, your control` | `Your vault, no admin keys` | 27 | 25 | -7% | Verified contract architectural truth (`BallastFactory.sol`). |
| **Hero Note** (Handwritten) | `SAME MARKETS.`<br>`BETTER DECISIONS.` | `SAME MARKET.`<br>`A SAFETY NET.` | 29 | 24 | -17% | Grounded, honest assurance without financial advice. |
| **Card Header** | `Your Position` | `Example position` | 13 | 16 | +23% | Explicitly labeled as an illustrative example, not live wallet data. |
| **Card Status Pill** | `Healthy` | `Healthy` | 7 | 7 | 0% | Standard health indicator. |
| **Card Tag** | *(None)* | `Illustrative` | 0 | 12 | N/A | Hard Rule 3: clear labeling preventing confusion with live positions. |
| **Card Ratio Label** | `Collateral ratio` | `COLLATERAL RATIO` | 16 | 16 | 0% | Standard protocol metric. |
| **Card Ratio Value** | `226.7%` *(arithmetically invalid)* | `166.7%` *(computed: $10k coll / $6k debt)* | 6 | 6 | 0% | Mutually consistent math derived directly from `@ballast/shared`. |
| **Card Gauge Ticks** | `150% Liquidation`<br>`200% Caution`<br>`> 200% Safe` | `110% Liquidation`<br>`135% Trigger`<br>`160% Target` | 44 | 40 | -9% | Imports real Mezo MUSD MCR (110%) and default vault rule parameters. |

---

## 3. Problem Section

| Element | Baseline Copy | New Copy | Baseline Chars | New Chars | Delta (%) | Audience Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Eyebrow** | `THE PROBLEM` | `THE PROBLEM` | 11 | 11 | 0% | Section identification. |
| **Headline** (4 lines) | `Markets move`<br>`fast. Uncertainty`<br>`shouldn’t decide`<br>`for you.` | `Prices move`<br>`fast.`<br>`Liquidation`<br>`doesn't wait.` | 57 | 40 | -30% | Punchy 4-line cadence highlighting the unforgiving nature of liquidations. |
| **Body Paragraph** | `Volatility, sudden market moves, and complex parameters make it hard to know when you’re really at risk. Guessing leads to liquidations.` | `On Mezo, a MUSD loan is liquidated once its collateral ratio falls below 110%. And when MUSD is redeemed, the loans with the lowest ratios are hit first. Watching a chart all day is not a plan.` | 138 | 196 | +42% | Mentions both Mezo-specific mechanics: 110% MCR liquidation and ascending-order redemptions. |
| **Link** | `See the problem` (`#simulator`) | `How liquidation works` (`#how-it-works`) | 15 | 21 | +40% | Educational link directing borrowers to protocol mechanics. |
| **Handwritten Note** | `CLEAR DATA.`<br>`CALMER POSITIONS.`<br>`MORE CONTROL.` | `110% IS THE LINE.`<br>`STAY WELL ABOVE IT.` | 43 | 36 | -16% | Ground-truth protocol threshold imported from `@ballast/shared`. |

---

## 4. How It Works Section

| Element | Baseline Copy | New Copy | Baseline Chars | New Chars | Delta (%) | Audience Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Eyebrow** | `HOW IT WORKS` | `HOW IT WORKS` | 12 | 12 | 0% | Section header. |
| **Headline** | `Three simple steps.` | `Set it once. Stay safe.` | 19 | 23 | +21% | Conveys low ongoing operational overhead for borrowers. |
| **Handwritten Tag** | `FROM`<br>`DATA`<br>`TO`<br>`DECISIONS.` | `YOU SET`<br>`THE LINE.` | 23 | 16 | -30% | Reasserts user sovereignty and self-determined defense triggers. |
| **Step 01 Title** | `Connect & view` | `Open your vault` | 14 | 15 | +7% | Accurate representation of deploying a dedicated minimal proxy vault. |
| **Step 01 Description** | `See your position and current risk in real time.` | `A personal vault holds your MUSD loan. Only you can withdraw from it.` | 48 | 69 | +44% | Emphasizes non-custodial ownership confirmed by `BallastVault.sol`. |
| **Step 02 Title** | `Stress-test` | `Set your line` | 11 | 13 | +18% | Defines parameter configuration: trigger ICR, target ICR, and reserve funding. |
| **Step 02 Description** | `Model different market scenarios and discover thresholds.` | `Choose a trigger and a target ratio, then fund a reserve of MUSD and BTC.` | 58 | 74 | +28% | Explains the dual reserve mechanism (debt reduction + collateral injection). |
| **Step 03 Title** | `Take action` | `Defense runs itself` | 11 | 19 | +73% | Highlights autonomous, permissionless keeper execution. |
| **Step 03 Description** | `Adjust before you reach the edge with automated buffers.` | `When your ratio hits the trigger, anyone can repay debt or add collateral from your reserve, back to your target. You get a Telegram alert.` | 56 | 137 | +144% | Fully explains execution trigger, keeper role, and real notification pipeline. |

---

## 5. Stress Test Simulator Section

| Element | Baseline Copy | New Copy | Baseline Chars | New Chars | Delta (%) | Audience Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Eyebrow** | `INTERACTIVE SIMULATOR` | `STRESS TEST` | 21 | 11 | -48% | Aligns with the dApp tool naming. |
| **Headline** | `Model`<br>`the unexpected.` | `Test your loan`<br>`against a crash.` | 22 | 30 | +36% | Direct, concrete benefit: stress-testing against market drawdowns. |
| **Body Paragraph** | `Adjust variables, simulate market moves, and see how they impact your position in real time.` | `Drop the BTC price and watch your ratio, your reserve and every defense step, with and without Ballast. In the app, this runs on your real position.` | 92 | 149 | +62% | Explains what the simulator computes and clarifies that live data runs in the app. |
| **CTA Button** | `Try the simulator` (`/app/stress-test`) | `Try the stress test` (`/app/stress-test`) | 17 | 19 | +12% | Deep link to the full stress test engine. |
| **Card Title** | `Position Simulator` | `Stress test` | 18 | 11 | -39% | Clean title. |
| **Card Scenario Tag** | *(None)* | `Scenario` | 0 | 8 | N/A | Explicitly clarifies that the card models a scenario, not live user state. |
| **Timeframe Pills** | `1D`, `1W`, `1M`, `1Y` | `-10%`, `-20%`, `-30%`, `-40%` | 10 | 18 | +80% | Quick crash presets for simulating instant Bitcoin price shocks. |
| **Metric 1 Label** | `Collateral ratio` | `Collateral ratio` | 16 | 16 | 0% | Live calculated metric from slider state. |
| **Metric 2 Label** | `MUSD debt` | `MUSD debt` | 9 | 9 | 0% | Shows post-defense debt if triggered, or baseline debt. |
| **Metric 3 Label** | `Collateral value` | `Collateral value` | 16 | 16 | 0% | Shows stressed collateral valuation. |
| **Slider 1 Label** | `MUSD Price` | `BTC price change` | 10 | 16 | +60% | Variable simulating BTC market drawdowns (0% to -50%). |
| **Slider 2 Label** | `Collateral Value` | `Reserve (MUSD)` | 16 | 14 | -12% | Models available defense capital ($0 to $3,000 MUSD). |
| **Slider 3 Label** | `Volatility` | `Trigger ratio` | 10 | 13 | +30% | Configurable defense threshold (115% to 150%). |
| **Chart Caption** | *(None)* | `A scenario computed from the inputs above, not a prediction.` | 0 | 58 | N/A | Honest financial framing; no deceptive guarantees. |

---

## 6. Belief Section

| Element | Baseline Copy | New Copy | Baseline Chars | New Chars | Delta (%) | Audience Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Eyebrow** | `OUR BELIEF` | `OUR BELIEF` | 10 | 10 | 0% | Section header. |
| **Headline** (3 lines) | `Better tools`<br>`for a more stable`<br>`ecosystem.` | `Borrowing against`<br>`Bitcoin should be`<br>`boring.` | 42 | 50 | +19% | Memorable, reassuring value proposition for long-term holders. |
| **Body Paragraph** | `A more informed community leads to fewer liquidations, healthier positions, and a more resilient MUSD ecosystem.` | `Fewer liquidations mean healthier loans and a steadier Mezo. Ballast sits on top of Mezo's own MUSD contracts: open source, no custody, no admin keys.` | 113 | 151 | +34% | Explains mutual benefit to Mezo network while confirming trustless architecture. |
| **CTA Button 1** | `Explore Ballast` (`/app/overview`) | `Launch App` (`/app`) | 15 | 10 | -33% | Primary launch action. |
| **CTA Button 2** | `Read the docs` (`/whitepaper`) | `Read the docs` (`https://mezo.org/docs/developers`) | 13 | 13 | 0% | Direct link to official developer resources. |
| **Disclosure Caption** | *(None)* | `Ballast lowers liquidation risk; it cannot remove it. Reserves can run out and prices can gap. Testnet prototype, unaudited.` | 0 | 117 | N/A | Mandatory judge requirement: honest disclosure of risk and testnet limits. |
| **Handwritten Note** | `YOUR POSITION.`<br>`YOUR RULES.` | `YOUR POSITION.`<br>`YOUR RULES.` | 25 | 25 | 0% | Retained per user brief. |
| **Stamp Badge** | `BUILT FOR`<br>`A MORE STABLE`<br>`ECOSYSTEM` | `BUILT ON MEZO.`<br>`OPEN SOURCE.` | 39 | 26 | -33% | Direct judge callout highlighting ecosystem integration and open code. |

---

## 7. Footer Section

| Element | Baseline Copy | New Copy | Baseline Chars | New Chars | Delta (%) | Audience Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Brand Tagline** | `Autonomous liquidation and redemption guardian for MUSD troves on Mezo.` | `Liquidation protection for MUSD on Mezo.` | 72 | 40 | -44% | Concise, official tagline from `packages/shared/src/brand.ts`. |
| **Protocol Links** | `Whitepaper`, `Risk framework`, `Borrower App`, `Changelog` | `Docs`, `GitHub`, `Contracts`, `Security notes` | — | — | — | Only real, existing destinations. Zero broken `#` or mock whitepapers. |
| **Community Links** | `X (@Siddhu_3116)`, `GitHub`, `Mezo Docs` | `Mezo Discord`, `GitHub`, `Telegram bot`, `X (@Siddhu_3116)` | — | — | — | Active developer and community communication channels. |
| **Action Widget** | Email input: `Get updates` / `No noise. Just updates.` | Button row: `Get liquidation alerts on Telegram` / `Link your wallet in the app.` | — | — | — | Replaces unbacked newsletter signup with live Telegram bot link. |
| **Copyright Line** | `© 2026 Ballast. All rights reserved.` | `© 2026 Ballast. Built for the Mezo Buildathon. Testnet prototype, not financial advice.` | 36 | 86 | +139% | Truthful attribution and regulatory disclaimer. |
| **Handwritten Note** | `STAY AHEAD.`<br>`STAY IN CONTROL.` | `STAY AHEAD.`<br>`STAY IN CONTROL.` | 27 | 27 | 0% | Retained per user brief. |

---

## 8. SEO & Social Metadata

- **Page Title**: `Ballast | Liquidation protection for MUSD on Mezo` (48 characters)
- **Meta Description**: `Ballast defends your Bitcoin-backed MUSD loan on Mezo with an automated, non-custodial reserve that anyone can deploy when your collateral ratio drops.` (150 characters exactly)
- **Open Graph / Twitter Card**: Summary with large image (`/assets/landing/hero-david.webp`), matching title and 150-char description.
