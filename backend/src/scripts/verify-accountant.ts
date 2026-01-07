import { strict as assert } from 'node:assert';

const API_URL = 'http://localhost:3000';

async function waitForServer() {
  console.log('Waiting for server...');
  for (let i = 0; i < 30; i++) {
    try {
      await fetch(API_URL); // Just check if it accepts connection
      console.log('Server is reachable!');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error('Server did not start in time');
}

type LoginResponse = { token: string };
type Budget = {
  id: number;
  month: string;
  income: string;
  expenses: string;
  note: string;
};

async function main() {
  await waitForServer();

  console.log('--- Verifying Accountant Flow ---');

  // 1. Login
  console.log('1. Logging in as ct_accountant...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'ct_accountant', password: 'CHANGE_ME' }),
  });

  if (!loginRes.ok) {
    console.error('Login failed:', await loginRes.text());
    process.exit(1);
  }

  const loginData = (await loginRes.json()) as LoginResponse;
  const token = loginData.token;
  assert(token, 'Token not received');
  console.log('Login successful. Token received.');

  // 2. Create Budget
  console.log('2. Creating Budget...');
  const budgetPayload = {
    month: '2025-05-01',
    income: 500000,
    expenses: 450000,
    note: 'Test budget via script',
  };

  const createRes = await fetch(`${API_URL}/accountant/budgets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(budgetPayload),
  });

  if (!createRes.ok) {
    console.error('Create Budget failed:', await createRes.text());
    process.exit(1);
  }
  console.log('Budget created.');

  // 3. List Budgets
  console.log('3. Listing Budgets...');
  const listRes = await fetch(
    `${API_URL}/accountant/budgets?month=2025-05-01`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!listRes.ok) {
    console.error('List Budgets failed:', await listRes.text());
    process.exit(1);
  }

  const budgets = (await listRes.json()) as Budget[];
  console.log('Budgets found:', budgets.length);

  const found = budgets.find((b) => b.note === 'Test budget via script');
  assert(found, 'Created budget not found in list');
  console.log('Verified: Budget exists in DB.');

  console.log('--- Accountant Flow Verified Successfully ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
