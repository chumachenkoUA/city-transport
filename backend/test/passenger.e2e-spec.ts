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

    const cardsResponse = await request(app.getHttpServer())
      .get('/passenger/cards')
      .set(authHeader(token))
      .expect(200);
    const cards = cardsResponse.body as Array<{
      id?: number;
      card_number?: string;
    }>;
    const primary =
      cards.find((item) => item.card_number === seed.passenger.cardNumber) ??
      cards[0];
    cardId = Number(primary?.id ?? seed.passenger.cardId);
    cardNumber = primary?.card_number ?? seed.passenger.cardNumber;
  });

  afterAll(async () => {
    await releaseTestApp();
  });

  it('lists passenger cards', async () => {
    const response = await request(app.getHttpServer())
      .get('/passenger/cards')
      .set(authHeader(token))
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const cards = response.body as Array<{
      id?: number;
      card_number?: string;
    }>;
    expect(cards.some((item) => item.card_number === seed.passenger.cardNumber))
      .toBe(true);
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

    expect(Number(response.body?.id)).toBe(seed.fineId);
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

  it('finds routes between points', async () => {
    const from = seed.stops[0];
    const to = seed.stops[1];
    const response = await request(app.getHttpServer())
      .get('/passenger/routes/near')
      .set(authHeader(token))
      .query({
        lonA: from.lon,
        latA: from.lat,
        lonB: to.lon,
        latB: to.lat,
      })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('submits a complaint', async () => {
    await request(app.getHttpServer())
      .post('/passenger/complaints')
      .set(authHeader(token))
      .send({
        type: 'Complaint',
        message: 'Passenger complaint',
        routeNumber: seed.routeNumber,
        transportType: seed.transportTypeName,
      })
      .expect(201);
  });
});
