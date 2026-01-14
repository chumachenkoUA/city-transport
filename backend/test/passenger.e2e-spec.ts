import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getTestApp, releaseTestApp } from './utils/app';
import { authHeader, loginAs } from './utils/auth';
import { ensureSeedData, type SeedData } from './utils/seed';

jest.setTimeout(30000);

describe('CtPassenger (e2e)', () => {
  let app: INestApplication;
  let seed: SeedData;
  let token: string;
  let cardId: number;
  let cardNumber: string;

  beforeAll(async () => {
    app = await getTestApp();
    seed = await ensureSeedData();
    const login = await loginAs(
      app,
      seed.passenger.login,
      seed.passenger.password,
    );
    token = login.token;

    const cardResponse = await request(app.getHttpServer())
      .get('/passenger/card')
      .set(authHeader(token))
      .expect(200);
    const card = cardResponse.body as {
      id?: number;
      cardNumber?: string;
    };
    cardId = Number(card?.id ?? seed.passenger.cardId);
    cardNumber = card?.cardNumber ?? seed.passenger.cardNumber;
  });

  afterAll(async () => {
    await releaseTestApp();
  });

  it('gets passenger card', async () => {
    const response = await request(app.getHttpServer())
      .get('/passenger/card')
      .set(authHeader(token))
      .expect(200);

    expect(response.body).toHaveProperty('cardNumber');
    expect(response.body.cardNumber).toBe(seed.passenger.cardNumber);
  });

  it('tops up a card', async () => {
    await request(app.getHttpServer())
      .post(`/passenger/cards/${cardNumber}/top-up`)
      .set(authHeader(token))
      .send({ amount: 25 })
      .expect(201);
  });

  it('buys a ticket', async () => {
    const response = await request(app.getHttpServer())
      .post('/passenger/tickets/buy')
      .set(authHeader(token))
      .send({
        cardId,
        tripId: seed.trips.finishedId,
        price: 10,
      })
      .expect(201);

    expect(response.body).toHaveProperty('ticketId');
  });

  it('lists trips', async () => {
    const response = await request(app.getHttpServer())
      .get('/passenger/trips')
      .set(authHeader(token))
      .expect(200);

    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('trips');
  });

  it('lists fines', async () => {
    const response = await request(app.getHttpServer())
      .get('/passenger/fines')
      .set(authHeader(token))
      .expect(200);

    expect(response.body).toHaveProperty('total');
    expect(response.body).toHaveProperty('fines');
  });

  it('returns fine details', async () => {
    const response = await request(app.getHttpServer())
      .get(`/passenger/fines/${seed.fineId}`)
      .set(authHeader(token))
      .expect(200);

    const body = response.body as { id?: number | string } | null;
    expect(Number(body?.id)).toBe(seed.fineId);
  });

  it('submits an appeal', async () => {
    const response = await request(app.getHttpServer())
      .post(`/passenger/fines/${seed.fineId}/appeals`)
      .set(authHeader(token))
      .send({ message: 'Appeal message' })
      .expect(201);

    expect(response.body).toHaveProperty('appealId');
  });

  it('returns nearby stops', async () => {
    const stop = seed.stops[0];
    const response = await request(app.getHttpServer())
      .get('/passenger/stops/near')
      .set(authHeader(token))
      .query({ lon: stop.lon, lat: stop.lat, radius: 700 })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('finds routes between points (plan)', async () => {
    const from = seed.stops[0];
    const to = seed.stops[1];
    const response = await request(app.getHttpServer())
      .get('/passenger/routes/plan')
      .set(authHeader(token))
      .query({
        lonA: from.lon,
        latA: from.lat,
        lonB: to.lon,
        latB: to.lat,
        radius: 1000,
      })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    if (response.body.length > 0) {
      expect(response.body[0]).toHaveProperty('totalTimeMin');
      expect(response.body[0]).toHaveProperty('segments');
    }
  });

  it('submits a complaint', async () => {
    await request(app.getHttpServer())
      .post('/passenger/complaints')
      .set(authHeader(token))
      .send({
        type: 'complaint',
        message: 'Passenger complaint',
        routeNumber: seed.routeNumber,
        transportType: seed.transportTypeName,
      })
      .expect(201);
  });
});
