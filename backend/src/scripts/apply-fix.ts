import { Client } from 'pg';
import fs from 'fs';
import path from 'path';

const client = new Client({
  connectionString:
    process.env.DATABASE_URL_MIGRATOR ||
    'postgresql://ct_migrator:52468@localhost:5455/city_transport',
});

async function main() {
  await client.connect();

  const sqlFile = path.join(
    process.cwd(),
    'drizzle',
    '0031_rename_passenger_func.sql',
  );
  const sql = fs.readFileSync(sqlFile, 'utf-8');

  console.log('Applying 0031 manually...');
  await client.query(sql);
  console.log('Applied.');

  await client.end();
}

main().catch(console.error);
