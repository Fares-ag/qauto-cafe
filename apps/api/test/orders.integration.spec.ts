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
    if (app) await app.close();
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

  async function createPaidOrder() {
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

    const payRes = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/pay`)
      .set(authHeader(token))
      .send({
        payments: [{ method: 'CASH', amount: total }],
        idempotencyKey: `test-pay-${orderId}-${Date.now()}`,
      })
      .expect(201);

    return { orderId, total, payRes };
  }

  it('creates, pays, and fully refunds an order', async () => {
    const { orderId, total } = await createPaidOrder();
    expect(parseFloat(total)).toBeGreaterThan(0);

    const refundRes = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/refund`)
      .set(authHeader(token))
      .send({ reason: 'QA integration test refund' })
      .expect(201);

    expect(refundRes.body.status).toMatch(/REFUNDED|PARTIALLY_REFUNDED/);
  });

  it('records COGS on payment and supports idempotent pay', async () => {
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
    const idempotencyKey = `test-idempotent-${orderId}`;

    const firstPay = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/pay`)
      .set(authHeader(token))
      .send({
        payments: [{ method: 'CARD', amount: total }],
        idempotencyKey,
      })
      .expect(201);

    expect(firstPay.body.order.status).toBe('PAID');
    expect(parseFloat(firstPay.body.order.cogsTotal)).toBeGreaterThanOrEqual(0);

    const secondPay = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/pay`)
      .set(authHeader(token))
      .send({
        payments: [{ method: 'CARD', amount: total }],
        idempotencyKey,
      })
      .expect(201);

    expect(secondPay.body.order.status).toBe('PAID');
    expect(secondPay.body.order.cogsTotal).toBe(firstPay.body.order.cogsTotal);

    const orderRes = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set(authHeader(token))
      .expect(200);

    expect(orderRes.body.status).toBe('PAID');
    expect(orderRes.body.cogsTotal).toBe(firstPay.body.order.cogsTotal);
  });

  it('voids a paid order', async () => {
    const { orderId } = await createPaidOrder();

    const voidRes = await request(app.getHttpServer())
      .post(`/api/v1/orders/${orderId}/void`)
      .set(authHeader(token))
      .send({ reason: 'QA integration void test' })
      .expect(201);

    expect(voidRes.body.status).toBe('VOIDED');

    const orderRes = await request(app.getHttpServer())
      .get(`/api/v1/orders/${orderId}`)
      .set(authHeader(token))
      .expect(200);

    expect(orderRes.body.status).toBe('VOIDED');
  });
});
