import { Page, expect } from '@playwright/test';

async function getPosTerminalId(page: Page): Promise<string> {
  const bootstrap = await page.request.get('/api/v1/public/bootstrap');
  expect(bootstrap.ok()).toBeTruthy();
  const body = await bootstrap.json();
  const terminal = (body.terminals as Array<{ id: string; type: string }> | undefined)?.find(
    (t) => t.type === 'POS',
  );
  expect(terminal?.id).toBeTruthy();
  return terminal!.id;
}

function seedAuthStorage(
  page: Page,
  data: {
    accessToken?: string;
    user: unknown;
    branchId?: string;
    sessionType: 'staff' | 'manager';
  },
) {
  return page.addInitScript((payload) => {
    localStorage.setItem(
      'qauto-web-auth',
      JSON.stringify({
        state: {
          user: payload.user,
          branchId: payload.branchId ?? null,
          sessionType: payload.sessionType,
          posTerminalId: null,
          kitchenTerminalId: null,
          shiftId: null,
          currentShift: null,
        },
        version: 0,
      }),
    );
    if (payload.accessToken) {
      sessionStorage.setItem('qauto-e2e-access-token', payload.accessToken);
    }
  }, data);
}

export async function loginAsManager(page: Page) {
  const response = await page.request.post('/api/v1/auth/login', {
    data: { email: 'admin@qauto.com', password: 'admin123' },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();

  await seedAuthStorage(page, {
    accessToken: body.accessToken,
    user: body.user,
    branchId: body.branchId,
    sessionType: 'manager',
  });

  await page.goto('/dashboard');
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page
    .waitForResponse((r) => r.url().includes('/auth/refresh') && r.ok(), { timeout: 30000 })
    .catch(() => undefined);
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('qauto-web-auth');
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { state?: { branchId?: string } };
    return Boolean(parsed.state?.branchId);
  }, { timeout: 30000 });
}

export async function loginWithPin(page: Page, pin = '1234') {
  const terminalId = await getPosTerminalId(page);
  const response = await page.request.post('/api/v1/auth/pin-login', {
    data: { terminalId, pin },
  });
  expect(response.ok()).toBeTruthy();
  const body = await response.json();

  await seedAuthStorage(page, {
    accessToken: body.accessToken,
    user: body.user,
    branchId: body.branchId,
    sessionType: 'staff',
  });

  await page.goto('/sell');
  await page.waitForURL(/\/sell/, { timeout: 30000 });
  await page
    .waitForResponse((r) => r.url().includes('/auth/refresh') && r.ok(), { timeout: 30000 })
    .catch(() => undefined);
}

export async function sellOneItemAndPayCash(page: Page) {
  await page.goto('/sell');
  await page.getByRole('button', { name: 'Open shift' }).click({ timeout: 10000 }).catch(() => {});
  await page.getByRole('heading', { name: /^Sell$/i }).waitFor({ timeout: 15000 });

  const menuItem = page.locator('button').filter({ hasText: /Latte|Americano|Croissant/i }).first();
  await menuItem.click({ timeout: 15000 });

  const sizeButton = page.getByRole('button', { name: /^M$|Medium/i }).first();
  if (await sizeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await sizeButton.click();
    await page.getByRole('button', { name: /Add to order|Add/i }).click();
  }

  await page.getByRole('button', { name: 'More payment options' }).click();
  await page.getByRole('button', { name: 'Pay later · send to kitchen' }).click();
  await expect(page.getByText(/sent to kitchen|payment pending/i)).toBeVisible({ timeout: 30000 });

  await page.goto('/orders');
  await page.getByRole('button', { name: 'Collect payment' }).first().click({ timeout: 10000 });
  await page.getByRole('button', { name: /Cash/i }).first().click();
}
