import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<{ accessToken: string; branchId: string }> {
  const loginRes = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(201);

  const accessToken = loginRes.body.accessToken as string;
  expect(accessToken).toBeDefined();

  let branchId = loginRes.body.branchId as string | undefined;
  if (!branchId) {
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    branchId =
      (meRes.body.branchId as string | undefined) ??
      (meRes.body.branches as Array<{ id: string; isDefault: boolean }> | undefined)?.find(
        (b) => b.isDefault,
      )?.id;
  }
  expect(branchId).toBeDefined();

  return { accessToken, branchId: branchId! };
}

export async function loginAsAdmin(app: INestApplication) {
  return loginAs(app, 'admin@qauto.com', 'admin123');
}

export async function loginAsCashier(app: INestApplication) {
  return loginAs(app, 'cashier@qauto.com', 'cashier123');
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
