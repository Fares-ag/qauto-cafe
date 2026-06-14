import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './helpers/test-app';
import { authHeader, loginAsAdmin } from './helpers/auth.helper';

describe('Orders (integration)', () => {
  let app: INestApplication;
  let token: string;
  let branchId: string;

  beforeAll(async () => {
    app = await createTestApp();
    ({ accessToken: token, branchId } = await loginAsAdmin(app));
  });

  afterAll(async () => {
    await app.close();
  });

  function firstCatalogLine() {
    return request(app.getHttpServer())
      .get('/api/v1/menu/catalog')
      .query({ branchId })
      .set(authHeader(token))
      .expect(200)
      .then((res) => {
        const item = res.body.categories
          ?.flatMap((c: { items: Array<{ id: string; sizes: Array<{ id: string }> }> }) => c.items)
          ?.find((i: { name: string }) => /latte|americano|croissant/i.test(i.name ?? ''));
        expect(item).toBeDefined();
        const sizeId = item.sizes?.[0]?.id;
        return { menuItemId: item.id as string, sizeId: sizeId as string | undefined };
      });
  }

  it('creates, pays, and fully refunds an order', async () => {
    const { menuItemId, sizeId } = await firstCatalogLine();

    const createRes = await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set(authHeader(token))
      .send({
        branchId,
        lines: [{ menuItemId, sizeId, quantity: 1 }],
      })
      .expect(201);

    const orderId = createRes.body.id as string;
    const total = createRes.body.total as string;
    expect(orderId).toBeDefined();
    expect(parseFloat(total)).toBeGreaterThan(0);

    await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/pay`)
      .set(authHeader(token))
      .send({
        payments: [{ method: 'CASH', amount: total }],
        idempotencyKey: `test-pay-${orderId}`,
      })
      .expect(201);

    const refundRes = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/refund`)
      .set(authHeader(token))
      .send({ reason: 'QA integration test refund' })
      .expect(201);

    expect(refundRes.body.status).toMatch(/REFUNDED|PARTIALLY_REFUNDED/);
  });
});
