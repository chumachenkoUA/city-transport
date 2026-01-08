import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getTestApp, releaseTestApp } from './utils/app';
import { authHeader, loginAs } from './utils/auth';
import { ensureSeedData, type SeedData } from './utils/seed';

jest.setTimeout(30000);

describe('CtManager (e2e)', () => {
  let app: INestApplication;
  let seed: SeedData;
  let token: string;

  beforeAll(async () => {
    app = await getTestApp();
    seed = await ensureSeedData();
    const login = await loginAs(app, 'ct_manager', 'CHANGE_ME');
    token = login.token;
  });

  afterAll(async () => {
    await releaseTestApp();
  });

  it('lists reference data', async () => {
    await request(app.getHttpServer())
      .get('/manager/drivers')
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .get('/manager/vehicles')
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .get('/manager/routes')
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .get('/manager/transport-types')
      .set(authHeader(token))
      .expect(200);
  });

  it('hires driver and adds vehicle', async () => {
    const suffix = Date.now().toString().slice(-6);
    const login = `mgr${suffix}`;
    const phone = `+38099${suffix}`;

    const driver = await request(app.getHttpServer())
      .post('/manager/drivers')
      .set(authHeader(token))
      .send({
        login,
        password: 'driver123',
        email: `${login}@test.local`,
        phone,
        fullName: `Manager Driver ${suffix}`,
        driverLicenseNumber: `MGR-${suffix}`,
        licenseCategories: ['D'],
        passportData: { series: 'ME', number: suffix },
      })
      .expect(201);

    const driverBody = driver.body as { id?: number } | undefined;
    expect(driverBody?.id).toBeDefined();

    const vehicle = await request(app.getHttpServer())
      .post('/manager/vehicles')
      .set(authHeader(token))
      .send({
        fleetNumber: `MGR-${suffix}`,
        transportTypeId: seed.transportTypeId,
        capacity: 45,
        routeNumber: seed.routeNumber,
      })
      .expect(201);

    const vehicleBody = vehicle.body as { id?: number } | undefined;
    expect(vehicleBody?.id).toBeDefined();
  });
});
