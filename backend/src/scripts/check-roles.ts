import { Client } from 'pg';

// Using DATABASE_URL from root .env manually
const client = new Client({
  connectionString:
    'postgresql://kirito:app_9Bf4sJ2kK8pP3nG7qL1vX5cZ0mRtY6h@localhost:5455/city_transport',
});

async function main() {
  await client.connect();
  console.log('Roles:');
  const res = await client.query(
    `SELECT rolname FROM pg_roles WHERE rolname LIKE 'ct_%'`,
  );
  console.table(res.rows);

  console.log('Migrations:');
  const mig = await client.query(`SELECT * FROM drizzle.__drizzle_migrations`);
  console.table(mig.rows);

  await client.end();
}

main().catch(console.error);
