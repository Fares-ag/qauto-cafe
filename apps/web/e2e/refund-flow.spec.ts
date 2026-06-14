import { test, expect } from '@playwright/test';
import { loginAsManager, sellOneItemAndPayCash } from './helpers/auth';

test('manager refunds a paid order', async ({ page }) => {
  await loginAsManager(page);
  await sellOneItemAndPayCash(page);

  await page.goto('/orders');
  await expect(page.getByText(/#\d+/).first()).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: /void \/ refund/i }).first().click();
  await page.getByLabel('Reason').fill('QA E2E refund test');
  await page.getByRole('button', { name: 'Refund', exact: true }).click();

  await expect(page.locator('span').filter({ hasText: 'Refunded' }).first()).toBeVisible({
    timeout: 15000,
  });
});
