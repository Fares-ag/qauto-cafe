import { test, expect } from '@playwright/test';
import { loginAsManager } from './helpers/auth';

test('login → sell → defer → kitchen → collect payment', async ({ page }) => {
  await loginAsManager(page);
  await page.goto('/sell');
  await page.getByRole('button', { name: 'Open shift' }).click({ timeout: 10000 }).catch(() => {});

  await page.waitForSelector('text=Register', { timeout: 15000 });

  const menuItem = page.locator('button').filter({ hasText: /Latte|Americano|Croissant/i }).first();
  await menuItem.click({ timeout: 15000 });

  const sizeButton = page.getByRole('button', { name: /^M$|Medium/i }).first();
  if (await sizeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sizeButton.click();
    await page.getByRole('button', { name: /Add to order|Add/i }).click();
  }

  await page.getByRole('button', { name: /Send to kitchen · pay later/i }).click();
  await expect(page.getByText(/sent to kitchen|payment pending/i)).toBeVisible({ timeout: 30000 });

  await page.goto('/orders');
  await page.getByRole('button', { name: 'Collect payment' }).first().click({ timeout: 10000 });
  await page.getByRole('button', { name: /Cash/i }).first().click();
});
