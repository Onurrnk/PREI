import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import type { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<AppConfig, true>);

  // Versioned API prefix.
  app.setGlobalPrefix('api');

  // Validate & strip unknown fields on every request DTO.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  // Allow the PREI frontend to call the API with credentials.
  app.enableCors({
    origin: config.get('frontendUrl', { infer: true }),
    credentials: true,
  });

  const port = config.get('port', { infer: true });
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`PREI backend listening on http://localhost:${port}/api`);
}

void bootstrap();
