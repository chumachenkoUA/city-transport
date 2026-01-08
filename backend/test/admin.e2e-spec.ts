import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getTestApp, releaseTestApp } from './utils/app';
import { authHeader, loginAs } from './utils/auth';
import { ensureSeedData } from './utils/seed';

jest.setTimeout(30000);

describe('CtAdmin (e2e)', () => {
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    app = await getTestApp();
    await ensureSeedData();
    const login = await loginAs(app, 'ct_admin', 'CHANGE_ME');
    token = login.token;
  });

  afterAll(async () => {
    await releaseTestApp();
  });

  it('returns summary', async () => {
    const response = await request(app.getHttpServer())
      .get('/admin/summary')
      .set(authHeader(token))
      .expect(200);

    expect(response.body).toHaveProperty('users');
    expect(response.body).toHaveProperty('drivers');
  });

  it('manages users, drivers, stops, routes, and vehicles', async () => {
    const suffix = Date.now().toString().slice(-6);

    const createdUser = await request(app.getHttpServer())
      .post('/admin/users')
      .set(authHeader(token))
      .send({
        login: `adminuser${suffix}`,
        email: `adminuser${suffix}@test.local`,
        phone: `+38097${suffix}`,
        fullName: `Admin User ${suffix}`,
      })
      .expect(201);

    const userBody = createdUser.body as { id?: number } | undefined;
    const userId = userBody?.id;
    expect(userId).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/admin/users/${userId}`)
      .set(authHeader(token))
      .send({ fullName: `Admin User ${suffix} Updated` })
      .expect(200);

    const createdDriver = await request(app.getHttpServer())
      .post('/admin/drivers')
      .set(authHeader(token))
      .send({
        login: `admindrv${suffix}`,
        password: 'driver123',
        email: `admindrv${suffix}@test.local`,
        phone: `+38098${suffix}`,
        fullName: `Admin Driver ${suffix}`,
        driverLicenseNumber: `ADM-${suffix}`,
        licenseCategories: ['D'],
        passportData: { series: 'AD', number: suffix },
      })
      .expect(201);

    const driverBody = createdDriver.body as { id?: number } | undefined;
    const driverId = driverBody?.id;
    expect(driverId).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/admin/drivers/${driverId}`)
      .set(authHeader(token))
      .send({ fullName: `Admin Driver ${suffix} Updated` })
      .expect(200);

    const createdStop = await request(app.getHttpServer())
      .post('/admin/stops')
      .set(authHeader(token))
      .send({ name: `Admin Stop ${suffix}`, lon: 24.033, lat: 49.849 })
      .expect(201);

    const stopBody = createdStop.body as { id?: number } | undefined;
    const stopId = stopBody?.id;
    expect(stopId).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/admin/stops/${stopId}`)
      .set(authHeader(token))
      .send({ name: `Admin Stop ${suffix} Updated` })
      .expect(200);

    const createdType = await request(app.getHttpServer())
      .post('/admin/transport-types')
      .set(authHeader(token))
      .send({ name: `AdminType${suffix}` })
      .expect(201);

    const typeBody = createdType.body as { id?: number } | undefined;
    const typeId = typeBody?.id;
    expect(typeId).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/admin/transport-types/${typeId}`)
      .set(authHeader(token))
      .send({ name: `AdminType${suffix}Updated` })
      .expect(200);

    const createdRoute = await request(app.getHttpServer())
      .post('/admin/routes')
      .set(authHeader(token))
      .send({
        transportTypeId: typeId,
        number: `A${suffix}`,
        direction: 'forward',
        isActive: true,
      })
      .expect(201);

    const routeBody = createdRoute.body as { id?: number } | undefined;
    const routeId = routeBody?.id;
    expect(routeId).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/admin/routes/${routeId}`)
      .set(authHeader(token))
      .send({ number: `A${suffix}X` })
      .expect(200);

    const createdVehicle = await request(app.getHttpServer())
      .post('/admin/vehicles')
      .set(authHeader(token))
      .send({
        fleetNumber: `ADM-${suffix}`,
        routeId,
      })
      .expect(201);

    const vehicleBody = createdVehicle.body as { id?: number } | undefined;
    const vehicleId = vehicleBody?.id;
    expect(vehicleId).toBeDefined();

    await request(app.getHttpServer())
      .patch(`/admin/vehicles/${vehicleId}`)
      .set(authHeader(token))
      .send({ fleetNumber: `ADM-${suffix}-UPD` })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/admin/vehicles/${vehicleId}`)
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/admin/routes/${routeId}`)
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/admin/transport-types/${typeId}`)
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/admin/stops/${stopId}`)
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/admin/drivers/${driverId}`)
      .set(authHeader(token))
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/admin/users/${userId}`)
      .set(authHeader(token))
      .expect(200);
  });
});
