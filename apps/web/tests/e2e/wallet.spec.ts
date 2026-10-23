import { test, expect } from '@playwright/test';

test.describe('Wallet Integration & Connect Modal E2E', () => {
  test('landing page header renders wallet button and network chip', async ({ page }) => {
    await page.goto('/');

    // Verify network chip shows Mezo Matsnet
    const networkChip = page.getByText('Mezo Matsnet', { exact: true }).first();
    await expect(networkChip).toBeVisible();

    // Verify Connect Wallet button is present in header
    const connectBtn = page.getByRole('button', { name: /Connect Wallet/i }).first();
    await expect(connectBtn).toBeVisible();
  });

  test('connect modal opens and displays Bitcoin and EVM wallet groups', async ({ page }) => {
    await page.goto('/');

    const connectBtn = page.getByRole('button', { name: /Connect Wallet/i }).first();
    await connectBtn.click();

    // Verify RainbowKit modal dialog opens
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Verify wallet group headings or wallet options
    // In RainbowKit, group names or wallets are rendered
    await expect(dialog.getByText(/UniSat|Bitcoin|MetaMask|EVM/i).first()).toBeVisible();
  });

  test('wallet-check route renders honest empty state when disconnected', async ({ page }) => {
    await page.goto('/app/wallet-check');

    // Rule 1: NO MOCKS — honest empty state
    await expect(page.getByText('Wallet Not Connected')).toBeVisible();
    await expect(
      page.getByText(/Connect an EVM wallet.*or a Bitcoin wallet/i)
    ).toBeVisible();
  });
});
