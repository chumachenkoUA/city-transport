import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getTestApp, releaseTestApp } from './utils/app';
import { authHeader, loginAs } from './utils/auth';
import { ensureSeedData, type SeedData } from './utils/seed';

jest.setTimeout(30000);

describe('CtAccountant (e2e)', () => {
  let app: INestApplication;
  let seed: SeedData;
  let token: string;

  beforeAll(async () => {
    app = await getTestApp();
    seed = await ensureSeedData();
    const login = await loginAs(app, 'ct_accountant', 'CHANGE_ME');
    token = login.token;
  });

  afterAll(async () => {
    await releaseTestApp();
  });

  it('upserts budget', async () => {
    const month = new Date();
    const monthStart = `${month.getFullYear()}-${String(
      month.getMonth() + 1,
    ).padStart(2, '0')}-01`;

    const response = await request(app.getHttpServer())
      .post('/accountant/budgets')
      .set(authHeader(token))
      .send({
        month: monthStart,
        income: 120000,
        expenses: 45000,
        note: 'Plan',
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
  });

  it('lists budgets', async () => {
    const response = await request(app.getHttpServer())
      .get('/accountant/budgets')
      .set(authHeader(token))
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('adds an expense', async () => {
    const response = await request(app.getHttpServer())
      .post('/accountant/expenses')
      .set(authHeader(token))
      .send({
        category: 'Fuel',
        amount: 1500,
        description: 'Test expense',
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
  });

  it('lists expenses', async () => {
    const response = await request(app.getHttpServer())
      .get('/accountant/expenses')
      .set(authHeader(token))
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('creates salary payment', async () => {
    const response = await request(app.getHttpServer())
      .post('/accountant/salaries')
      .set(authHeader(token))
      .send({
        driverId: seed.drivers[0].id,
        employeeRole: 'Driver',
        rate: 200,
        units: 8,
        total: 1600,
      })
      .expect(201);

    expect(response.body).toHaveProperty('id');
  });

  it('lists salary history', async () => {
    const response = await request(app.getHttpServer())
      .get('/accountant/salaries')
      .set(authHeader(token))
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('returns income summary', async () => {
    const response = await request(app.getHttpServer())
      .get('/accountant/income')
      .set(authHeader(token))
      .expect(200);

    expect(response.body).toHaveProperty('income');
  });

  it('returns financial report', async () => {
    const response = await request(app.getHttpServer())
      .get('/accountant/report')
      .set(authHeader(token))
      .expect(200);

    expect(response.body).toHaveProperty('summary');
  });
});
