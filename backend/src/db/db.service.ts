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
import { RequestContextService } from '../common/session/request-context.service';
import * as schema from './schema';

@Injectable()
export class DbService implements OnApplicationShutdown, OnModuleInit {
  private readonly baseDb: NodePgDatabase<typeof schema>;
  private readonly basePool: Pool;
  private readonly guestDb: NodePgDatabase<typeof schema>;
  private readonly guestPool: Pool;
  private readonly baseConfig: {
    host: string;
    port: number;
    database: string;
  };
  private readonly userPoolMax: number;
  private readonly userPoolIdleMs: number;
  private readonly userPools = new Map<
    string,
    { pool: Pool; db: NodePgDatabase<typeof schema>; password: string }
  >();

  constructor(
    private readonly config: ConfigService,
    private readonly contextService: RequestContextService,
  ) {
    const connectionString = this.config.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }

    const url = new URL(connectionString);
    this.baseConfig = {
      host: url.hostname,
      port: url.port ? Number(url.port) : 5432,
      database: url.pathname.replace(/^\//, ''),
    };
    const poolMax = Number(this.config.get<string>('DB_USER_POOL_MAX'));
    const poolIdle = Number(this.config.get<string>('DB_USER_POOL_IDLE_MS'));
    this.userPoolMax = Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 2;
    this.userPoolIdleMs =
      Number.isFinite(poolIdle) && poolIdle > 0 ? poolIdle : 30000;

    // Base pool for migrations (superuser/ct_migrator)
    this.basePool = new Pool({ connectionString });
    this.baseDb = drizzle(this.basePool, { schema });

    // Guest pool for unauthenticated requests (ct_guest)
    const guestConnectionString = this.config.get<string>('DATABASE_URL_GUEST');
    if (guestConnectionString) {
      this.guestPool = new Pool({ connectionString: guestConnectionString });
      this.guestDb = drizzle(this.guestPool, { schema });
    } else {
      // Fallback to base pool if DATABASE_URL_GUEST is not set
      this.guestPool = this.basePool;
      this.guestDb = this.baseDb;
    }
  }

  get db(): NodePgDatabase<typeof schema> {
    const session = this.contextService.get();
    if (!session?.login || !session.password) {
      return this.guestDb; // Use guest pool for unauthenticated requests
    }

    const cached = this.userPools.get(session.login);
    if (cached && cached.password === session.password) {
      return cached.db;
    }

    if (cached) {
      void cached.pool.end();
      this.userPools.delete(session.login);
    }

    const pool = new Pool({
      host: this.baseConfig.host,
      port: this.baseConfig.port,
      database: this.baseConfig.database,
      user: session.login,
      password: session.password,
      max: this.userPoolMax,
      idleTimeoutMillis: this.userPoolIdleMs,
    });
    const db = drizzle(pool, { schema });
    this.userPools.set(session.login, {
      pool,
      db,
      password: session.password,
    });

    return db;
  }

  async onModuleInit(): Promise<void> {
    await migrate(this.baseDb, {
      migrationsFolder: join(process.cwd(), 'drizzle'),
    });

    if (this.config.get<string>('SEED_ON_START') === 'true') {
      // Use dynamic import to avoid ESM/CJS issues.

      const seedDatabase = (await import('../seed.js')).seedDatabase;

      await seedDatabase();
    }
  }

  async onApplicationShutdown(): Promise<void> {
    await this.basePool.end();
    // Close guest pool only if it's separate from base pool
    if (this.guestPool !== this.basePool) {
      await this.guestPool.end();
    }
    for (const entry of this.userPools.values()) {
      await entry.pool.end();
    }
  }

  async closeUserPool(login: string): Promise<void> {
    const entry = this.userPools.get(login);
    if (!entry) {
      return;
    }
    this.userPools.delete(login);
    await entry.pool.end();
  }
}
