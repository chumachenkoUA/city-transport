import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { join } from 'node:path';
import { Pool } from 'pg';
import * as schema from './schema';

@Injectable()
export class DbService implements OnApplicationShutdown, OnModuleInit {
  readonly db: NodePgDatabase<typeof schema>;
  private readonly pool: Pool;

  constructor(private readonly config: ConfigService) {
    const connectionString = this.config.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }

    this.pool = new Pool({ connectionString });
    this.db = drizzle(this.pool, { schema });
  }

  async onModuleInit(): Promise<void> {
    await migrate(this.db, {
      migrationsFolder: join(process.cwd(), 'drizzle'),
    });
  }

  async onApplicationShutdown(): Promise<void> {
    await this.pool.end();
  }
}
