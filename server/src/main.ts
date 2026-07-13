// Sentry enstrümantasyonu her şeyden ÖNCE yüklenmeli (otomatik yakalama).
import './instrument';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger)); // pino'yu Nest logger'ı yap
  const config = app.get(ConfigService<AppConfig, true>);

  // G-3: güvenlik başlıkları
  app.use(helmet());

  app.setGlobalPrefix('api');

  // DTO-dışı alanları reddet, tipleri dönüştür (semantik + şema doğrulama)
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  // G-3: CORS allowlist — yalnız PREI frontend'i
  app.enableCors({
    origin: config.get('frontendUrl', { infer: true }),
    credentials: true,
  });

  const port = config.get('port', { infer: true });
  await app.listen(port);
}

void bootstrap();
