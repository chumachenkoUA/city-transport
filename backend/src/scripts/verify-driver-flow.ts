import { strict as assert } from 'node:assert';

const API_URL = 'http://localhost:3000';

async function waitForServer() {
  console.log('Waiting for server...');
  for (let i = 0; i < 30; i++) {
    try {
      await fetch(API_URL);
      console.log('Server is reachable!');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Server did not start in time');
}

type LoginResponse = { token: string };
type StartTripResponse = { tripId: number };

async function login(login: string) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, password: 'CHANGE_ME' }),
  });
  if (!res.ok)
    throw new Error(`Login failed for ${login}: ${await res.text()}`);
  const data = (await res.json()) as LoginResponse;
  return data.token;
}

async function main() {
  await waitForServer();
  console.log('--- Verifying Driver Flow ---');

  // 1. Login Driver 1
  console.log('1. Logging in Driver 1...');
  const token1 = await login('driver1');
  const fleetNumber = 'AB-001'; // From seed

  // 2. Start Trip
  console.log('2. Starting Trip...');
  const startRes = await fetch(`${API_URL}/driver/trips/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({ fleetNumber }),
  });

  if (!startRes.ok) {
    console.error('Start Trip failed:', await startRes.text());
    process.exit(1);
  }
  const tripData = (await startRes.json()) as StartTripResponse;
  const tripId = tripData.tripId;
  console.log('Trip started. ID:', tripId);
  assert(tripId, 'Trip ID missing');

  // 3. Send GPS
  console.log('3. Sending GPS...');
  const gpsRes = await fetch(`${API_URL}/driver/trips/gps`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({ lon: 30.501, lat: 50.401 }),
  });
  assert(gpsRes.ok, 'GPS Log failed');
  console.log('GPS logged.');

  // 4. Try Start AGAIN (Should fail)
  console.log('4. Trying to start duplicate trip (expect failure)...');
  const startRes2 = await fetch(`${API_URL}/driver/trips/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({ fleetNumber }),
  });

  if (startRes2.ok) {
    console.error('Error: Duplicate start trip succeeded! It should fail.');
    process.exit(1);
  } else {
    console.log('Correctly rejected duplicate start:', await startRes2.json());
  }

  // 5. Finish Trip
  console.log('5. Finishing Trip...');
  const finishRes = await fetch(`${API_URL}/driver/trips/finish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({}),
  });
  assert(finishRes.ok, 'Finish Trip failed');
  console.log('Trip finished.');

  // 6. Set Passengers
  console.log('6. Setting Passengers...');
  const passRes = await fetch(`${API_URL}/driver/trips/passengers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token1}`,
    },
    body: JSON.stringify({ tripId, passengerCount: 42 }),
  });
  if (!passRes.ok) {
    console.error('Set Passengers failed:', await passRes.text());
    process.exit(1);
  }
  console.log('Passengers set.');

  console.log('--- Driver Flow Verified Successfully ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
