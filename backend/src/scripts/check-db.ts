import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://driver1:CHANGE_ME@localhost:5455/city_transport',
});

async function main() {
  await client.connect();
  const res = await client.query(`
    SELECT n.nspname, p.proname, pg_get_function_arguments(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'driver_api';
  `);
  console.table(res.rows);
  await client.end();
}

main().catch(console.error);
