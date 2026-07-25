import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { loadEnv } from '../../shared/env';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool = new Pool({
    connectionString: loadEnv().DATABASE_URL
  });

  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: unknown[]
  ): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, values);
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('begin');
      const result = await callback(client);
      await client.query('commit');
      return result;
    } catch (error) {
      await client.query('rollback');
      throw error;
    } finally {
      client.release();
    }
  }

  async acquireAdvisoryLock(key: string): Promise<() => Promise<void>> {
    const client = await this.pool.connect();
    let released = false;

    try {
      await client.query('select pg_advisory_lock(hashtextextended($1, 0))', [key]);
    } catch (error) {
      client.release();
      throw error;
    }

    return async () => {
      if (released) {
        return;
      }

      released = true;
      try {
        await client.query('select pg_advisory_unlock(hashtextextended($1, 0))', [key]);
      } finally {
        client.release();
      }
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
