import 'dotenv/config';
import { Client } from 'pg';

async function main() {
  const url = process.env.DATABASE_URL;
  const migratorUrl = process.env.DATABASE_URL_MIGRATOR;
  
  console.log('DATABASE_URL:', url ? url.replace(/:[^:@]+@/, ':***@') : 'undefined');
  console.log('DATABASE_URL_MIGRATOR:', migratorUrl ? migratorUrl.replace(/:[^:@]+@/, ':***@') : 'undefined');

  const connectionString = url;
  if (!connectionString) {
    console.error('DATABASE_URL is not set');
    process.exit(1);
  }
  console.log('Using DB URL:', connectionString.replace(/:[^:@]+@/, ':***@'));

  const client = new Client({
    connectionString,
  });

  try {
    await client.connect();
    console.log('Connected to DB');

    try {
      const viewCheck = await client.query('SELECT count(*) FROM guest_api.v_routes');
      console.log('v_routes count:', viewCheck.rows[0]);
    } catch (e) {
      console.log('v_routes check failed:', e.message);
    }

    const funcs = await client.query(`
      SELECT p.proname, pg_get_function_arguments(p.oid) as args
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'guest_api'
    `);
    console.log('Functions in guest_api:', funcs.rows);

    const query = `
      SELECT route_option
      FROM guest_api.plan_route(
        $1::numeric, $2::numeric, $3::numeric, $4::numeric, 500::numeric, 10, 5
      )
    `;
    const params = [
       24.032875234014455,
       49.83908035828887,
       24.023020548092603,
       49.85430017848151
    ];

    console.log('Executing query...');
    const res = await client.query(query, params);
    console.log('Result:', JSON.stringify(res.rows, null, 2));

  } catch (err) {
    console.error('ERROR OCCURRED:');
    console.error(err);
  } finally {
    await client.end();
  }
}

main();