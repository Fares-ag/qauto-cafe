import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';
import { authHeader, loginAsAdmin } from './helpers/auth.helper';

describe('Inventory (integration)', () => {
  let app: INestApplication;
  let token: string;
  let branchId: string;
  let ingredientId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ({ accessToken: token, branchId } = await loginAsAdmin(app));

    const ingredientsRes = await request(app.getHttpServer())
      .get('/api/v1/admin/ingredients')
      .set(authHeader(token))
      .expect(200);

    const ingredient = ingredientsRes.body.find(
      (i: { trackStock?: boolean; isPackaging?: boolean }) => i.trackStock && !i.isPackaging,
    );
    expect(ingredient).toBeDefined();
    ingredientId = ingredient.id as string;
  });

  afterAll(async () => {
    await app.close();
  });

  it('lists UOMs', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/inventory/uoms')
      .set(authHeader(token))
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('receive stock increases on-hand quantity', async () => {
    const beforeRes = await request(app.getHttpServer())
      .get('/api/v1/inventory/stock')
      .query({ branchId })
      .set(authHeader(token))
      .expect(200);

    const before = beforeRes.body.items.find(
      (i: { ingredientId: string }) => i.ingredientId === ingredientId,
    );
    const beforeQty = parseFloat(before?.available ?? '0');

    await request(app.getHttpServer())
      .post('/api/v1/inventory/receive')
      .set(authHeader(token))
      .send({
        branchId,
        ingredientId,
        quantity: '10',
        unitCost: '1.50',
        notes: 'QA integration receive',
      })
      .expect(201);

    const afterRes = await request(app.getHttpServer())
      .get('/api/v1/inventory/stock')
      .query({ branchId })
      .set(authHeader(token))
      .expect(200);

    const after = afterRes.body.items.find(
      (i: { ingredientId: string }) => i.ingredientId === ingredientId,
    );
    const afterQty = parseFloat(after?.available ?? '0');

    expect(afterQty).toBeGreaterThan(beforeQty);
    expect(after.valueOnHandQar).toBeDefined();
  });
});
