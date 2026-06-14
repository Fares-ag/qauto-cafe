import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Auth (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health/live returns ok', () => {
    return request(app.getHttpServer()).get('/api/v1/health/live').expect(200).expect(({ body }) => {
      expect(body.status).toBe('ok');
    });
  });

  it('POST /auth/login rejects invalid credentials', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@qauto.com', password: 'wrong-password' })
      .expect(401);
  });

  it('POST /auth/login succeeds for seeded admin', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'admin@qauto.com', password: 'admin123' })
      .expect(201)
      .expect(({ body }) => {
        expect(body.user.role).toBeDefined();
        expect(body.accessToken).toBeDefined();
      });
  });

  it('GET /menu/catalog requires authentication', () => {
    return request(app.getHttpServer())
      .get('/api/v1/menu/catalog')
      .query({ branchId: '00000000-0000-0000-0000-000000000000' })
      .expect(401);
  });
});
