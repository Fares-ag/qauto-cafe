import { test, expect } from '@playwright/test';
import { loginWithPin } from './helpers/auth';

test('PIN staff can search office directory including no-extension staff', async ({ page }) => {
  await loginWithPin(page);
  await page.goto('/sell');
  await page.getByRole('button', { name: 'Open shift' }).click({ timeout: 10000 }).catch(() => {});
  await expect(page.getByRole('heading', { name: /^Register$/i })).toBeVisible({ timeout: 15000 });

  await expect(page.getByRole('button', { name: 'Staff' })).toBeVisible();
  await page.getByLabel('Search staff').fill('Alnadi');
  await expect(page.getByText('No ext.', { exact: true }).first()).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: /Alnadi/i }).first().click();
  await expect(page.getByText('No extension')).toBeVisible();
});
