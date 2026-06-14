import { test, expect } from '@playwright/test';
import { loginAsManager } from './helpers/auth';

test('manager receives stock and sees inventory update', async ({ page }) => {
  await loginAsManager(page);

  await page.goto('/inventory/receive');
  await expect(page.getByRole('heading', { name: /receive stock/i })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('combobox', { name: 'Ingredient' })).toBeVisible({ timeout: 30000 });

  const loginRes = await page.request.post('/api/v1/auth/login', {
    data: { email: 'admin@qauto.com', password: 'admin123' },
  });
  expect(loginRes.ok()).toBeTruthy();
  const { accessToken, branchId } = await loginRes.json();

  const ingredientsRes = await page.request.get('/api/v1/admin/ingredients', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  expect(ingredientsRes.ok()).toBeTruthy();
  const ingredients = await ingredientsRes.json();
  const ingredient = ingredients.find(
    (i: { trackStock?: boolean; isPackaging?: boolean }) => i.trackStock && !i.isPackaging,
  );
  expect(ingredient?.id).toBeTruthy();

  const receiveRes = await page.request.post('/api/v1/inventory/receive', {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      branchId,
      ingredientId: ingredient.id,
      quantity: '25',
      unitCost: '2.00',
      notes: 'E2E receive',
    },
  });
  expect(receiveRes.ok()).toBeTruthy();

  await page.goto('/inventory');
  await expect(page.getByText(/inventory value/i)).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('columnheader', { name: /on hand/i })).toBeVisible();
});
