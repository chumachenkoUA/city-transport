import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getTestApp, releaseTestApp } from './utils/app';
import { authHeader, loginAs } from './utils/auth';
import { ensureSeedData, type SeedData } from './utils/seed';

jest.setTimeout(30000);

describe('CtDispatcher (e2e)', () => {
  let app: INestApplication;
  let seed: SeedData;
  let token: string;

  beforeAll(async () => {
    app = await getTestApp();
    seed = await ensureSeedData();
    const login = await loginAs(app, 'ct_dispatcher', 'CHANGE_ME');
    token = login.token;
  });

  afterAll(async () => {
    await releaseTestApp();
  });

  it('returns dashboard data', async () => {
    const routes = await request(app.getHttpServer())
      .get('/dispatcher/routes')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(routes.body)).toBe(true);

    const drivers = await request(app.getHttpServer())
      .get('/dispatcher/drivers')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(drivers.body)).toBe(true);

    const vehicles = await request(app.getHttpServer())
      .get('/dispatcher/vehicles')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(vehicles.body)).toBe(true);

    const dashboard = await request(app.getHttpServer())
      .get('/dispatcher/dashboard')
      .set(authHeader(token))
      .expect(200);
    expect(dashboard.body).toHaveProperty('activeTrips');
  });

  it('manages schedules and assignments', async () => {
    const created = await request(app.getHttpServer())
      .post('/dispatcher/schedules')
      .set(authHeader(token))
      .send({
        routeId: seed.routeId,
        fleetNumber: seed.vehicles[0].fleetNumber,
        workStartTime: '07:00',
        workEndTime: '20:00',
        intervalMin: 12,
      })
      .expect(201);

    const scheduleBody = created.body as { id?: number } | undefined;
    const scheduleId = scheduleBody?.id;
    expect(scheduleId).toBeDefined();

    const schedules = await request(app.getHttpServer())
      .get('/dispatcher/schedules')
      .set(authHeader(token))
      .expect(200);
    expect(Array.isArray(schedules.body)).toBe(true);

    const schedule = await request(app.getHttpServer())
      .get(`/dispatcher/schedules/${scheduleId}`)
      .set(authHeader(token))
      .expect(200);
    expect(schedule.body).toHaveProperty('routeNumber');

    await request(app.getHttpServer())
      .patch(`/dispatcher/schedules/${scheduleId}`)
      .set(authHeader(token))
      .send({ intervalMin: 15 })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/dispatcher/routes/${seed.routeId}/points`)
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .post('/dispatcher/assignments')
      .set(authHeader(token))
      .send({
        driverLogin: seed.drivers[0].login,
        fleetNumber: seed.vehicles[1].fleetNumber,
      })
      .expect(201);

    await request(app.getHttpServer())
      .get('/dispatcher/assignments')
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .get('/dispatcher/active-trips')
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .get('/dispatcher/deviations')
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .get(`/dispatcher/vehicles/${seed.vehicles[1].fleetNumber}/monitoring`)
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .post(`/dispatcher/vehicles/${seed.vehicles[1].fleetNumber}/deviation`)
      .set(authHeader(token))
      .send({ currentTime: new Date().toISOString() })
      .expect(201);
  });
});
