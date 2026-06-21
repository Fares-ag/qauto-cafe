import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/filters/problem-details.filter';
import { validateProductionConfig } from './config/validate-config';
import { applySecurityMiddleware } from './config/security';
import { SocketIoAdapter } from './ws/socket-io.adapter';

async function bootstrap() {
  validateProductionConfig();

  const app = await NestFactory.create(AppModule);

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3001);
  const corsOrigin = config.get<string>('CORS_ORIGIN', 'http://localhost:3000');

  applySecurityMiddleware(app);

  const socketAdapter = new SocketIoAdapter(app, config);
  app.useWebSocketAdapter(socketAdapter);

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

  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://0.0.0.0:${port}/api/v1`);
}

bootstrap();
