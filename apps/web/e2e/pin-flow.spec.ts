import { test, expect } from '@playwright/test';
import { loginWithPin } from './helpers/auth';

test('PIN login → sell screen', async ({ page }) => {
  await loginWithPin(page);
  await expect(page.getByRole('heading', { name: /^Register$/i })).toBeVisible({ timeout: 15000 });
});
