import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getTestApp, releaseTestApp } from './utils/app';
import { authHeader, loginAs } from './utils/auth';
import { ensureSeedData, type SeedData } from './utils/seed';

jest.setTimeout(30000);

describe('CtMunicipality (e2e)', () => {
  let app: INestApplication;
  let seed: SeedData;
  let token: string;

  beforeAll(async () => {
    app = await getTestApp();
    seed = await ensureSeedData();
    const login = await loginAs(app, 'ct_municipality', 'CHANGE_ME');
    token = login.token;
  });

  afterAll(async () => {
    await releaseTestApp();
  });

  it('lists reference data', async () => {
    await request(app.getHttpServer())
      .get('/municipality/transport-types')
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .get('/municipality/stops')
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .get('/municipality/routes')
      .set(authHeader(token))
      .expect(200);
  });

  it('creates and updates a stop', async () => {
    const suffix = Date.now().toString().slice(-6);
    const created = await request(app.getHttpServer())
      .post('/municipality/stops')
      .set(authHeader(token))
      .send({
        name: `Municipal Stop ${suffix}`,
        lon: 24.03,
        lat: 49.847,
      })
      .expect(201);

    const stopBody = created.body as { id?: number } | undefined;
    const stopId = stopBody?.id;
    expect(stopId).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/municipality/stops/${stopId}`)
      .set(authHeader(token))
      .send({
        name: `Municipal Stop ${suffix} Updated`,
        lon: 24.031,
        lat: 49.848,
      })
      .expect(200);
  });

  it('creates route with geometry', async () => {
    const suffix = Date.now().toString().slice(-6);
    const response = await request(app.getHttpServer())
      .post('/municipality/routes')
      .set(authHeader(token))
      .send({
        transportTypeId: seed.transportTypeId,
        number: `M${suffix}`,
        direction: 'forward',
        stops: [
          {
            stopId: seed.stops[0].id,
            distanceToNextKm: 0.5,
          },
          {
            stopId: seed.stops[1].id,
            distanceToNextKm: 0,
          },
        ],
        points: [
          { lon: seed.stops[0].lon, lat: seed.stops[0].lat },
          { lon: seed.stops[1].lon, lat: seed.stops[1].lat },
        ],
      })
      .expect(201);

    const routeBody = response.body as { route?: { id?: number } } | undefined;
    const routeId = routeBody?.route?.id;
    expect(routeId).toBeDefined();

    await request(app.getHttpServer())
      .get(`/municipality/routes/${routeId}/stops`)
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .get(`/municipality/routes/${routeId}/points`)
      .set(authHeader(token))
      .expect(200);
  });

  it('returns passenger flow and complaints', async () => {
    const today = new Date();
    const from = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];
    const to = today.toISOString().split('T')[0];

    const flow = await request(app.getHttpServer())
      .get('/municipality/passenger-flow')
      .set(authHeader(token))
      .query({ from, to })
      .expect(200);

    expect(Array.isArray(flow.body)).toBe(true);

    const complaints = await request(app.getHttpServer())
      .get('/municipality/complaints')
      .set(authHeader(token))
      .query({ from, to })
      .expect(200);

    expect(Array.isArray(complaints.body)).toBe(true);
  });
});
