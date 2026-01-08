import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getTestApp, releaseTestApp } from './utils/app';
import { authHeader, loginAs } from './utils/auth';
import { ensureSeedData, type SeedData } from './utils/seed';

jest.setTimeout(30000);

describe('CtController (e2e)', () => {
  let app: INestApplication;
  let seed: SeedData;
  let token: string;

  beforeAll(async () => {
    app = await getTestApp();
    seed = await ensureSeedData();
    const login = await loginAs(app, 'ct_controller', 'CHANGE_ME');
    token = login.token;
  });

  afterAll(async () => {
    await releaseTestApp();
  });

  it('checks card details', async () => {
    const response = await request(app.getHttpServer())
      .get(`/controller/cards/${seed.passenger.cardNumber}/check`)
      .set(authHeader(token))
      .expect(200);

    expect(response.body).toHaveProperty('cardNumber', seed.passenger.cardNumber);
  });

  it('issues a fine', async () => {
    const response = await request(app.getHttpServer())
      .post('/controller/fines')
      .set(authHeader(token))
      .send({
        cardNumber: seed.passenger.cardNumber,
        amount: 60,
        reason: 'No ticket',
        fleetNumber: seed.vehicles[1].fleetNumber,
      })
      .expect(201);

    expect(response.body).toHaveProperty('fineId');
  });
});
