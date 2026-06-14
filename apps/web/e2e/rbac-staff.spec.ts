import { test, expect } from '@playwright/test';
import { loginWithPin } from './helpers/auth';

test('PIN staff session cannot access manager inventory routes', async ({ page }) => {
  await loginWithPin(page);

  await page.goto('/inventory');
  await expect(page).toHaveURL(/\/sell/, { timeout: 10000 });

  await page.goto('/reports');
  await expect(page).toHaveURL(/\/sell/, { timeout: 10000 });
});
