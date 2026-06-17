import { test, expect } from '@playwright/test';
import { loginWithPin } from './helpers/auth';

test('PIN staff session can access stock and menu but not manager reports', async ({ page }) => {
  await loginWithPin(page);

  await page.goto('/inventory');
  await expect(page).toHaveURL(/\/inventory/, { timeout: 10000 });

  await page.goto('/menu/builder');
  await expect(page).toHaveURL(/\/menu\/builder/, { timeout: 10000 });

  await page.goto('/reports');
  await expect(page).toHaveURL(/\/sell/, { timeout: 10000 });
});
