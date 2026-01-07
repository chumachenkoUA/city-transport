import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const client = new Client({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://kirito:app_9Bf4sJ2kK8pP3nG7qL1vX5cZ0mRtY6h@localhost:5455/city_transport',
});

async function main() {
  await client.connect();
  const sqlFile = path.join(
    process.cwd(),
    'drizzle',
    '0001_roles_and_permissions.sql',
  );
  const sql = fs.readFileSync(sqlFile, 'utf-8');
  console.log('Executing SQL...');
  await client.query(sql);
  console.log('Executed.');

  const res = await client.query(
    `SELECT rolname FROM pg_roles WHERE rolname LIKE 'ct_%'`,
  );
  console.table(res.rows);

  await client.end();
}

main().catch(console.error);
