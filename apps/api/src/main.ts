import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './shared/env';
import { configureApp } from './shared/http/configure-app';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  await app.listen(env.PORT, env.HOST);
}

void bootstrap();
