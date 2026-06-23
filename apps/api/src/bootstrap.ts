import { join } from 'path';
import express from 'express';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { validateProductionConfig } from './config/validate-config';
import { applySecurityMiddleware } from './config/security';
import { SocketIoAdapter } from './ws/socket-io.adapter';

export async function createNestApplication(): Promise<INestApplication> {
  validateProductionConfig();

  const expressApp = express();
  // On Vercel, the Fetch→Express bridge (nest-server) pre-parses JSON into req.body.
  // Running express.json() there waits forever for a stream that never ends.
  if (!process.env.VERCEL) {
    expressApp.use(express.json({ limit: '2mb' }));
    expressApp.use(express.urlencoded({ extended: true, limit: '2mb' }));
  }
  const adapter = new ExpressAdapter(expressApp);
  const app = await NestFactory.create(AppModule, adapter, { bodyParser: false });

  const config = app.get(ConfigService);
  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:3000');
  const useLocalUploads = config.get<boolean>('storage.useLocalUploads', true);

  applySecurityMiddleware(app);

  if (useLocalUploads) {
    const uploadsDir = join(process.cwd(), config.get<string>('uploadsDir', 'uploads'));
    expressApp.use('/api/v1/uploads', express.static(uploadsDir));
  }

  if (!process.env.VERCEL) {
    const socketAdapter = new SocketIoAdapter(app, config);
    app.useWebSocketAdapter(socketAdapter);
  }

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.enableCors({
    origin: corsOrigin.split(',').map((o) => o.trim()),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());

  await app.init();
  return app;
}

export async function createNestExpressApp(): Promise<express.Express> {
  const app = await createNestApplication();
  return app.getHttpAdapter().getInstance() as express.Express;
}
