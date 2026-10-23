import { test, expect } from '@playwright/test';

test.describe('Ballast Guardian Pages E2E Suite', () => {
  test('global layout renders theme toggle, notification center, and verified explorer footer', async ({
    page,
  }) => {
    await page.goto('/app/overview');

    // 1. Theme toggle
    const themeToggle = page.locator('button[aria-label*="theme" i], button:has(svg.lucide-moon), button:has(svg.lucide-sun)');
    await expect(themeToggle.first()).toBeVisible();

    // 2. Notifications Center Trigger
    const notifTrigger = page.locator('button[aria-label*="notification" i], button:has(svg.lucide-bell)');
    await expect(notifTrigger.first()).toBeVisible();

    // Click notifications trigger to ensure popover opens
    await notifTrigger.first().click();
    await expect(page.getByText(/Activity & Notifications/i)).toBeVisible();

    // 3. Footer with Deployed Contracts linking to Mezo Matsnet Explorer
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer.getByText('BallastFactory')).toBeVisible();
    await expect(footer.getByText('BallastVault Impl')).toBeVisible();
    await expect(footer.getByText('BorrowerOperations')).toBeVisible();
    await expect(footer.getByText('TroveManager')).toBeVisible();

    // Verify explorer links
    const factoryLink = footer.locator('a[href*="explorer.test.mezo.org/address/0x8d5b392839300b487addeecc35f5bc534111cd33"]');
    await expect(factoryLink).toBeVisible();
  });

  test('/app/position: renders live active trove, resulting preview, action tabs, and close-trove breakdown', async ({
    page,
  }) => {
    await page.goto('/app/position');

    // Header and navigation
    await expect(page.getByRole('heading', { name: /Collateral & Debt Position/i })).toBeVisible();

    // On-Chain position metrics
    await expect(page.getByText(/Locked Collateral/i)).toBeVisible();
    await expect(page.getByText(/Total Trove Debt/i)).toBeVisible();
    await expect(page.getByText(/Individual Collateral Ratio/i)).toBeVisible();

    // Action tabs: Add Collateral, Borrow More, Repay MUSD, Withdraw BTC, Close Trove
    await expect(page.getByRole('tab', { name: /Add Collateral/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Borrow More/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Repay MUSD/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Withdraw BTC/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Close Trove/i })).toBeVisible();

    // Live preview card showing resulting ICR and liquidation price
    await expect(page.getByRole('heading', { name: /Resulting State Preview/i })).toBeVisible();
    await expect(page.getByText(/Simulated ICR/i)).toBeVisible();
    await expect(page.getByText(/New Liquidation Price/i)).toBeVisible();

    // Switch to Close Trove tab
    await page.getByRole('tab', { name: /Close Trove/i }).click();

    // Verify close-trove breakdown explains repayment source and returned collateral
    await expect(page.getByText(/Complete Trove Closure & Return Mechanics/i)).toBeVisible();
    await expect(page.getByText(/Shortfall from Connected Wallet/i)).toBeVisible();
    await expect(page.getByText(/Locked Collateral Returned/i)).toBeVisible();
    await expect(page.getByText(/200 MUSD reserve is refunded directly against debt/i)).toBeVisible();
  });

  test('/app/rules: renders live HealthGauge, interactive sliders, parameter diff, and plain-language consequence', async ({
    page,
  }) => {
    await page.goto('/app/rules');

    // Header
    await expect(page.getByRole('heading', { name: /Defense Rules Configuration/i })).toBeVisible();

    // Health gauge / Waterline Visualization
    await expect(page.getByText(/Collateral Ratio Waterline/i)).toBeVisible();

    // Protection switch
    await expect(page.getByRole('heading', { name: /Autonomous Protection Switch/i })).toBeVisible();
    await expect(page.getByRole('switch', { name: /Toggle defense rules/i })).toBeVisible();

    // Sliders
    await expect(page.getByText(/Defense Trigger ICR/i)).toBeVisible();
    await expect(page.getByText(/Restoration Target ICR/i)).toBeVisible();
    await expect(page.getByText('Keeper Tip Cap').first()).toBeVisible();

    // Plain-Language Rule Consequence
    await expect(page.getByText(/Plain-Language Rule Consequence/i)).toBeVisible();
    await expect(page.getByText(/When your position ICR falls below/i)).toBeVisible();

    // Parameter Diff
    await expect(page.getByRole('heading', { name: /Parameter Diff: Before vs. After/i })).toBeVisible();
  });

  test('/app/reserve: renders live reserve balances, disarm warning, and "BTC Price Drawdown Simulation" table', async ({
    page,
  }) => {
    await page.goto('/app/reserve');

    // Header
    await expect(page.getByRole('heading', { name: /Defense Reserve Balances/i })).toBeVisible();

    // Disarm warning banner
    await expect(page.getByText(/Critical Boundary: Withdrawing Reserve Disarms Autonomous Defense/i)).toBeVisible();
    await expect(page.getByText(/Withdrawing reserves directly reduces your vault's defense capacity/i)).toBeVisible();

    // Reserve tabs: Deposit MUSD, Deposit BTC, Withdraw MUSD, Withdraw BTC
    await expect(page.getByRole('tab', { name: /Deposit MUSD/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Deposit BTC/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Withdraw MUSD/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Withdraw BTC/i })).toBeVisible();

    // What Ballast Would Do Scenario table
    await expect(page.getByRole('heading', { name: /BTC Price Drawdown Simulation/i })).toBeVisible();
    await expect(page.getByText(/What Ballast Would Do/i)).toBeVisible();

    // Check table headers
    await expect(page.getByRole('columnheader', { name: 'Shock' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'BTC Price' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'No Ballast' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'With Ballast' })).toBeVisible();
  });

  test('/app/stress: renders live 0-60% shock slider, SVG chart, data table alternative, and projection disclaimer', async ({
    page,
  }) => {
    await page.goto('/app/stress');

    // Header
    await expect(page.getByRole('heading', { name: /Trove Stress Testing & Volatility Simulation/i })).toBeVisible();

    // Shock slider
    await expect(page.getByText(/Simulated Bitcoin Price Drawdown/i)).toBeVisible();

    // KPI cards
    await expect(page.getByText('Survival Floor', { exact: true })).toBeVisible();
    await expect(page.getByText(/Redemption Risk Exposure/i)).toBeVisible();

    // Interactive chart view and toggle
    await expect(page.getByRole('button', { name: /SVG Trajectory Chart/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Data Table Alternative/i })).toBeVisible();

    // Step-by-step defense sequence
    await expect(page.getByRole('heading', { name: /Step-by-Step Defense Sequence/i })).toBeVisible();

    // Strict Transparency Disclaimer
    await expect(page.getByText(/Strict Transparency Disclaimer:/i)).toBeVisible();
    await expect(page.getByText(/not a prediction or financial guarantee/i)).toBeVisible();
  });

  test('/app/alerts: renders Telegram linking interface with bot deep link and Convex status', async ({
    page,
  }) => {
    await page.goto('/app/alerts');

    // Header
    await expect(page.getByRole('heading', { name: /Threshold Alerts & Telegram Dispatch/i })).toBeVisible();

    // Telegram connection card
    await expect(page.getByRole('heading', { name: /Telegram Connection Status/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Start Telegram Linking Flow/i })).toBeVisible();

    // Privacy notice & Dispatched event types
    await expect(page.getByText(/Privacy & Security Protocol:/i)).toBeVisible();
    await expect(page.getByText(/Early Warning Watch Band/i)).toBeVisible();
    await expect(page.getByText(/Autonomous Defense Executed/i)).toBeVisible();
  });
});
