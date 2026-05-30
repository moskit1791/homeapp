import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadEnv } from './shared/env';
import { configureApp } from './shared/http/configure-app';
import { Pool } from 'pg';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);

  configureApp(app);

  const pool = new Pool({ connectionString: env.DATABASE_URL });
  try {
    await pool.query("alter type shopping_list_type add value if not exists 'pantry'");
    await pool.query('alter table cleaning_tasks add column if not exists location text');
  } catch (e) {
    console.error('Failed to run dynamic migrations:', e);
  } finally {
    await pool.end();
  }

  await app.listen(env.PORT, env.HOST);
}

void bootstrap();
