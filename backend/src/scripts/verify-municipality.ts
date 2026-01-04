import { strict as assert } from 'node:assert';

const API_URL = 'http://localhost:3000';

async function waitForServer() {
  console.log('Waiting for server...');
  for (let i = 0; i < 30; i++) {
    try {
      await fetch(API_URL);
      console.log('Server is reachable!');
      return;
    } catch (e) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Server did not start in time');
}

async function main() {
  await waitForServer();
  console.log('--- Verifying Municipality Flow ---');

  // 1. Login
  console.log('1. Logging in as ct_municipality...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'ct_municipality', password: 'CHANGE_ME' }),
  });

  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    process.exit(1);
  }

  const { token } = await loginRes.json();
  assert(token, 'Token not received');
  console.log('Login successful.');

  // 2. Create Stop
  console.log('2. Creating Stop...');
  const stopPayload = {
    name: 'Test Stop Municipality',
    lon: 30.555,
    lat: 50.444,
  };

  const createStopRes = await fetch(`${API_URL}/municipality/stops`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(stopPayload),
  });

  if (!createStopRes.ok) {
    console.error('Create Stop failed:', await createStopRes.text());
    process.exit(1);
  }
  const stopData = await createStopRes.json();
  console.log('Stop created:', stopData);
  assert(stopData.id, 'Stop ID missing');

  // 3. Create Route (with stops and points)
  console.log('3. Creating Route...');
  // We need at least 2 stops for a route. Let's use the created one twice or create another.
  // Ideally, use existing ones from seed.
  const routePayload = {
    transportTypeId: 1, // Bus
    number: '999-TEST',
    direction: 'forward',
    isActive: true,
    stops: [
      { stopId: stopData.id, distanceToNextKm: 1.5 },
      { name: 'End Stop', lon: 30.560, lat: 50.450 }, // New stop inline
    ],
    points: [
      { lon: 30.555, lat: 50.444 },
      { lon: 30.558, lat: 50.448 },
      { lon: 30.560, lat: 50.450 },
    ],
  };

  const createRouteRes = await fetch(`${API_URL}/municipality/routes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(routePayload),
  });

  if (!createRouteRes.ok) {
    console.error('Create Route failed:', await createRouteRes.text());
    process.exit(1);
  }
  const routeData = await createRouteRes.json();
  console.log('Route created:', routeData);
  assert(routeData.route?.id, 'Route ID missing');

  // 4. Verify Route List
  console.log('4. Listing Routes...');
  const listRes = await fetch(`${API_URL}/municipality/routes`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const routes = await listRes.json();
  const found = routes.find((r: any) => r.number === '999-TEST');
  assert(found, 'Created route not found in list');
  console.log('Verified: Route exists.');

  console.log('--- Municipality Flow Verified Successfully ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
