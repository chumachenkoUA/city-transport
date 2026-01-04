import { Client } from 'pg';

const client = new Client({
  connectionString: process.env.DATABASE_URL || 'postgresql://kirito:app_9Bf4sJ2kK8pP3nG7qL1vX5cZ0mRtY6h@localhost:5455/city_transport',
});

async function main() {
  await client.connect();
  console.log('Checking views in guest_api...');
  
  const res = await client.query(`
    SELECT table_schema, table_name, table_type 
    FROM information_schema.tables 
    WHERE table_schema = 'guest_api'
  `);
  
  if (res.rows.length === 0) {
    console.log('❌ No views found in guest_api!');
  } else {
    console.table(res.rows);
    console.log('✅ Views exist.');
  }
  
  await client.end();
}

main().catch(console.error);
