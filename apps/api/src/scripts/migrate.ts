import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Pool } from 'pg';
import { loadEnv } from '../shared/env';

const migrationsDir = join(__dirname, '..', '..', '..', '..', 'db', 'migrations');

async function migrate() {
  const env = loadEnv();
  const pool = new Pool({ connectionString: env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('begin');
    await client.query(`
      create table if not exists schema_migrations (
        version text primary key,
        executed_at timestamptz not null default now()
      )
    `);

    const files = (await readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort((a, b) => a.localeCompare(b));

    for (const file of files) {
      const version = file.replace(/\.sql$/, '');
      const existing = await client.query(
        'select 1 from schema_migrations where version = $1',
        [version]
      );

      if (existing.rowCount && existing.rowCount > 0) {
        continue;
      }

      const sql = await readFile(join(migrationsDir, file), 'utf8');
      await client.query(sql);
      await client.query('insert into schema_migrations (version) values ($1)', [version]);
      console.log(`Applied migration ${file}`);
    }

    await client.query('commit');
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

void migrate().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
