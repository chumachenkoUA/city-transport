import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getTestApp, releaseTestApp } from './utils/app';
import { authHeader, loginAs } from './utils/auth';
import { ensureSeedData, type SeedData } from './utils/seed';

jest.setTimeout(30000);

describe('CtDriver (e2e)', () => {
  let app: INestApplication;
  let seed: SeedData;
  let token: string;

  beforeAll(async () => {
    app = await getTestApp();
    seed = await ensureSeedData();
    const login = await loginAs(
      app,
      seed.drivers[0].login,
      seed.drivers[0].password,
    );
    token = login.token;
  });

  afterAll(async () => {
    await releaseTestApp();
  });

  it('returns driver profile', async () => {
    const response = await request(app.getHttpServer())
      .get('/driver/me')
      .set(authHeader(token))
      .expect(200);

    expect(response.body).toHaveProperty('login', seed.drivers[0].login);
  });

  it('returns schedule for date', async () => {
    const today = new Date().toISOString().split('T')[0];
    const response = await request(app.getHttpServer())
      .get('/driver/schedule')
      .set(authHeader(token))
      .query({ date: today })
      .expect(200);

    expect(response.body).toHaveProperty('date');
    expect(response.body).toHaveProperty('driver');
  });

  it('returns route stops and points', async () => {
    const stops = await request(app.getHttpServer())
      .get('/driver/routes/stops')
      .set(authHeader(token))
      .query({ routeId: seed.routeId })
      .expect(200);

    expect(Array.isArray(stops.body)).toBe(true);

    const points = await request(app.getHttpServer())
      .get('/driver/routes/points')
      .set(authHeader(token))
      .query({ routeId: seed.routeId })
      .expect(200);

    expect(Array.isArray(points.body)).toBe(true);
  });

  it('manages a driver trip flow', async () => {
    const existing = await request(app.getHttpServer())
      .get('/driver/active-trip')
      .set(authHeader(token))
      .expect(200);

    const existingBody = existing.body as {
      id?: number;
      endsAt?: string | null;
      startsAt?: string | null;
    } | null;

    if (existingBody?.id && existingBody.endsAt === null) {
      const startsAt = existingBody.startsAt
        ? new Date(existingBody.startsAt).getTime()
        : Date.now();
      const endedAt = new Date(Math.max(Date.now(), startsAt + 60000));
      await request(app.getHttpServer())
        .post('/driver/trips/finish')
        .set(authHeader(token))
        .send({ endedAt: endedAt.toISOString() })
        .expect(201);
    }

    const start = await request(app.getHttpServer())
      .post('/driver/trips/start')
      .set(authHeader(token))
      .send({ fleetNumber: seed.vehicles[0].fleetNumber })
      .expect(201);

    const startBody = start.body as { tripId?: number } | undefined;
    const tripId = startBody?.tripId;
    expect(tripId).toBeDefined();

    const active = await request(app.getHttpServer())
      .get('/driver/active-trip')
      .set(authHeader(token))
      .expect(200);

    expect(active.body).not.toBeNull();

    await request(app.getHttpServer())
      .post('/driver/trips/passengers')
      .set(authHeader(token))
      .send({ tripId, passengerCount: 7 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/driver/trips/gps')
      .set(authHeader(token))
      .send({ lon: 24.025, lat: 49.844 })
      .expect(201);

    await request(app.getHttpServer())
      .post('/driver/trips/finish')
      .set(authHeader(token))
      .send({ endedAt: new Date().toISOString() })
      .expect(201);
  });
});
