#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { Client } = require('pg');

const baseUrl =
  process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL;
if (!baseUrl) {
  console.error('DATABASE_URL or DATABASE_URL_MIGRATOR is not set');
  process.exit(1);
}

const base = new URL(baseUrl);
const baseDb = base.pathname.replace(/^\//, '') || 'postgres';
const rawPrefix = process.env.TEST_DB_PREFIX ?? `${baseDb}_e2e_`;
const prefix = rawPrefix.replace(/[^a-zA-Z0-9_]/g, '') || 'e2e_';
const dbName = `${prefix}${randomBytes(4).toString('hex')}`.toLowerCase();

const maintenanceDb = process.env.TEST_DB_MAINTENANCE ?? 'postgres';
const adminUrl = new URL(baseUrl);
adminUrl.pathname = `/${maintenanceDb}`;

const testUrl = new URL(baseUrl);
testUrl.pathname = `/${dbName}`;
const testDbUrl = testUrl.toString();

const env = {
  ...process.env,
  DATABASE_URL: testDbUrl,
  DATABASE_URL_MIGRATOR: testDbUrl,
};

const scriptName = process.argv[2] ?? 'test:e2e:jest';
const scriptArgs = process.argv.slice(3);

async function main() {
  let adminClient;
  let created = false;
  let exitCode = 1;

  try {
    adminClient = new Client({ connectionString: adminUrl.toString() });
    await adminClient.connect();

    const owner = base.username;
    const ownerSafe = owner && /^[a-zA-Z0-9_]+$/.test(owner) ? owner : null;
    const createSql = ownerSafe
      ? `CREATE DATABASE ${dbName} WITH OWNER ${ownerSafe}`
      : `CREATE DATABASE ${dbName}`;
    await adminClient.query(createSql);
    created = true;

    const setupClient = new Client({ connectionString: testDbUrl });
    await setupClient.connect();
    await setupClient.query('CREATE EXTENSION IF NOT EXISTS postgis');
    await setupClient.end();

    const migrateResult = spawnSync('pnpm', ['run', 'drizzle:migrate'], {
      stdio: 'inherit',
      env,
    });
    if (migrateResult.status !== 0) {
      exitCode = migrateResult.status ?? 1;
      return;
    }

    const testResult = spawnSync(
      'pnpm',
      ['run', scriptName, ...scriptArgs],
      {
        stdio: 'inherit',
        env,
      },
    );
    exitCode = testResult.status ?? 1;
  } catch (error) {
    console.error(error);
    exitCode = 1;
  } finally {
    if (adminClient) {
      if (created) {
        try {
          await adminClient.query(
            'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1',
            [dbName],
          );
          await adminClient.query(`DROP DATABASE ${dbName}`);
        } catch (error) {
          console.error('Failed to drop test database:', error);
        }
      }
      await adminClient.end().catch(() => undefined);
    }
    process.exit(exitCode);
  }
}

void main();
