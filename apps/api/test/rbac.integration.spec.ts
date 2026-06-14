import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';
import { authHeader, loginAsAdmin, loginAsCashier } from './helpers/auth.helper';

describe('RBAC (integration)', () => {
  let app: INestApplication;
  let adminToken: string;
  let cashierToken: string;
  let branchId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ({ accessToken: adminToken, branchId } = await loginAsAdmin(app));
    ({ accessToken: cashierToken } = await loginAsCashier(app));
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /inventory/stock without auth returns 401', () => {
    return request(app.getHttpServer())
      .get('/api/v1/inventory/stock')
      .query({ branchId })
      .expect(401);
  });

  it('cashier can view stock but cannot receive', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/inventory/stock')
      .query({ branchId })
      .set(authHeader(cashierToken))
      .expect(200);

    const ingredientsRes = await request(app.getHttpServer())
      .get('/api/v1/admin/ingredients')
      .set(authHeader(cashierToken))
      .expect(403);

    expect(ingredientsRes.body).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/v1/inventory/receive')
      .set(authHeader(cashierToken))
      .send({
        branchId,
        ingredientId: '00000000-0000-0000-0000-000000000001',
        quantity: '1',
        unitCost: '1',
      })
      .expect(403);
  });

  it('admin can receive stock', async () => {
    const ingredientsRes = await request(app.getHttpServer())
      .get('/api/v1/admin/ingredients')
      .set(authHeader(adminToken))
      .expect(200);

    const ingredient = ingredientsRes.body[0];
    expect(ingredient?.id).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/v1/inventory/receive')
      .set(authHeader(adminToken))
      .send({
        branchId,
        ingredientId: ingredient.id,
        quantity: '1',
        unitCost: '0.25',
        notes: 'RBAC admin receive',
      })
      .expect(201);
  });
});
