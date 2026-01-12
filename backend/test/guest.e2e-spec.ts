import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getTestApp, releaseTestApp } from './utils/app';
import { ensureSeedData, type SeedData } from './utils/seed';

jest.setTimeout(30000);

describe('CtGuest (e2e)', () => {
  let app: INestApplication;
  let seed: SeedData;

  beforeAll(async () => {
    app = await getTestApp();
    seed = await ensureSeedData();
  });

  afterAll(async () => {
    await releaseTestApp();
  });

  it('lists transport types', async () => {
    const response = await request(app.getHttpServer())
      .get('/guest/transport-types')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const types = response.body as Array<{ name?: string }>;
    expect(types.some((item) => item.name === seed.transportTypeName)).toBe(
      true,
    );
  });

  it('lists routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/guest/routes')
      .query({ transportTypeId: seed.transportTypeId })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const routes = response.body as Array<{ number?: string }>;
    expect(routes.some((item) => item.number === seed.routeNumber)).toBe(true);
  });

  it('returns nearby stops', async () => {
    const stop = seed.stops[0];
    const response = await request(app.getHttpServer())
      .get('/guest/stops/near')
      .query({ lon: stop.lon, lat: stop.lat, radius: 500, limit: 5 })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('returns routes by stop', async () => {
    const stop = seed.stops[0];
    const response = await request(app.getHttpServer())
      .get(`/guest/stops/${stop.id}/routes`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
  });

  it('returns route stops', async () => {
    const response = await request(app.getHttpServer())
      .get('/guest/routes/stops')
      .query({ routeId: seed.routeId })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const stops = response.body as unknown[];
    expect(stops.length).toBeGreaterThan(0);
  });

  it('returns route points', async () => {
    const response = await request(app.getHttpServer())
      .get('/guest/routes/points')
      .query({ routeId: seed.routeId })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const points = response.body as unknown[];
    expect(points.length).toBeGreaterThan(0);
  });

  it('returns route geometry', async () => {
    const response = await request(app.getHttpServer())
      .get('/guest/routes/geometry')
      .query({ routeId: seed.routeId })
      .expect(200);

    expect(response.body).not.toBeNull();
  });

  it('returns route geometries', async () => {
    const response = await request(app.getHttpServer())
      .get('/guest/routes/geometries')
      .query({ transportTypeId: seed.transportTypeId })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const geometries = response.body as unknown[];
    expect(geometries.length).toBeGreaterThan(0);
  });

  it('returns stop geometries', async () => {
    const response = await request(app.getHttpServer())
      .get('/guest/stops/geometries')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    const geometries = response.body as unknown[];
    expect(geometries.length).toBeGreaterThan(0);
  });

  it('finds routes between points (plan)', async () => {
    const from = seed.stops[0];
    const to = seed.stops[1];
    const response = await request(app.getHttpServer())
      .get('/guest/routes/plan')
      .query({
        lonA: from.lon,
        latA: from.lat,
        lonB: to.lon,
        latB: to.lat,
        radius: 1000,
        maxResults: 3,
      })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    if (response.body.length > 0) {
      expect(response.body[0]).toHaveProperty('totalTimeMin');
      expect(response.body[0]).toHaveProperty('segments');
    }
  });

  it('returns route schedule', async () => {
    const response = await request(app.getHttpServer())
      .get('/guest/routes/schedule')
      .query({ routeId: seed.routeId, stopId: seed.stops[0].id })
      .expect(200);

    expect(response.body).toHaveProperty('route');
    expect(response.body).toHaveProperty('schedule');
  });

  it('accepts guest complaint', async () => {
    await request(app.getHttpServer())
      .post('/guest/complaints')
      .send({
        type: 'Complaint',
        message: 'Guest complaint',
        contactInfo: 'guest@example.com',
      })
      .expect(201);
  });
});
