import { test, expect } from '@playwright/test';

test.describe('Ballast Core App Flows E2E', () => {
  test('connected burner wallet visits /app and sees Step 1 of Onboarding Wizard', async ({ page }) => {
    await page.goto('/app');

    // Verify wizard title and branding
    await expect(page.getByRole('heading', { name: 'Ballast Guardian Wizard' })).toBeVisible();
    await expect(page.getByText('Step 1 of 5')).toBeVisible();

    // Verify Step 1: Deploy Personal Vault
    await expect(page.getByRole('heading', { name: 'Deploy Personal Vault' })).toBeVisible();
    await expect(page.getByText(/Because Mezo BorrowerOperations requires the borrower to be the transaction sender/i)).toBeVisible();

    // Verify predicted deterministic address derivation
    await expect(page.getByText('Predicted Deterministic Address:')).toBeVisible();
    await expect(page.getByText('0x259D2f0372C63761c3C1dcEA531DaA1c2cA587e2')).toBeVisible();

    // Verify deploy action button
    const deployBtn = page.getByRole('button', { name: 'Deploy Personal Vault' });
    await expect(deployBtn).toBeVisible();
  });

  test('overview console displays honest empty state when user has no deployed vault', async ({ page }) => {
    await page.goto('/app/overview');

    // Check presence of borrower console header
    await expect(page.getByText('Borrower Console')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overview & Vault Status' })).toBeVisible();

    // For account 0x90F79bf6EB2c4f870365E785982E1f101E93b906 on fresh testnet, vault does not exist yet
    await expect(page.getByRole('heading', { name: 'No Personal Vault Deployed' })).toBeVisible();
    await expect(page.getByText(/You haven't deployed a personal BallastVault yet/i)).toBeVisible();

    // Verify call to action directs to wizard
    const startWizardLink = page.getByRole('link', { name: /Launch Setup Wizard/i });
    await expect(startWizardLink).toBeVisible();
  });

  test('disconnecting wallet transitions to honest disconnected state on /app', async ({ page }) => {
    await page.goto('/app');

    // Click on connected account button in header to open RainbowKit account modal
    const accountBtn = page.getByRole('button', { name: /0x90…b906/i });
    await expect(accountBtn).toBeVisible();
    await accountBtn.click();

    // Click Disconnect inside RainbowKit modal
    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    const disconnectBtn = dialog.getByRole('button', { name: /Disconnect/i });
    await expect(disconnectBtn).toBeVisible();
    await disconnectBtn.click();

    // Rule 1: NO MOCKS — honest state when disconnected
    await expect(page.getByRole('heading', { name: 'Connect Wallet to Begin Setup' })).toBeVisible();
    await expect(
      page.getByText(/Connect your Mezo or Bitcoin wallet to begin/i)
    ).toBeVisible();
  });

  test('disconnecting wallet transitions to honest disconnected state on /app/overview', async ({ page }) => {
    await page.goto('/app/overview');

    const accountBtn = page.getByRole('button', { name: /0x90…b906/i });
    await expect(accountBtn).toBeVisible();
    await accountBtn.click();

    const dialog = page.locator('[role="dialog"]');
    await expect(dialog).toBeVisible();
    const disconnectBtn = dialog.getByRole('button', { name: /Disconnect/i });
    await expect(disconnectBtn).toBeVisible();
    await disconnectBtn.click();

    // Rule 1: NO MOCKS — honest disconnected state
    await expect(page.getByRole('heading', { name: 'Connect Wallet to View Dashboard' })).toBeVisible();
    await expect(
      page.getByText(/Connect your browser wallet or Mezo smart account/i)
    ).toBeVisible();
  });
});
