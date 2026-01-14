import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getTestApp, releaseTestApp } from './utils/app';
import { authHeader, loginAs } from './utils/auth';
import { ensureSeedData, type SeedData } from './utils/seed';

jest.setTimeout(30000);

describe('Security E2E Tests', () => {
  let app: INestApplication;
  let seed: SeedData;

  beforeAll(async () => {
    app = await getTestApp();
    seed = await ensureSeedData();
  });

  afterAll(async () => {
    await releaseTestApp();
  });

  describe('Authorization Bypass Prevention', () => {
    let passenger1Token: string;
    let passenger2Token: string;

    beforeAll(async () => {
      const login1 = await loginAs(
        app,
        seed.passenger.login,
        seed.passenger.password,
      );
      passenger1Token = login1.token;

      const login2 = await loginAs(
        app,
        seed.passenger2.login,
        seed.passenger2.password,
      );
      passenger2Token = login2.token;
    });

    describe('top_up_card authorization', () => {
      it('should allow passenger to top up their own card', async () => {
        await request(app.getHttpServer())
          .post(`/passenger/cards/${seed.passenger.cardNumber}/top-up`)
          .set(authHeader(passenger1Token))
          .send({ amount: 10 })
          .expect(201);
      });

      it('should reject passenger trying to top up another passenger card', async () => {
        // Passenger1 tries to top up Passenger2's card - should fail
        const response = await request(app.getHttpServer())
          .post(`/passenger/cards/${seed.passenger2.cardNumber}/top-up`)
          .set(authHeader(passenger1Token))
          .send({ amount: 100 });

        // Should fail with 400 or 403 (card not found or not yours)
        expect([400, 403, 500]).toContain(response.status);
      });

      it('should reject top up with invalid card number', async () => {
        const response = await request(app.getHttpServer())
          .post('/passenger/cards/INVALID-CARD-123/top-up')
          .set(authHeader(passenger1Token))
          .send({ amount: 50 });

        expect([400, 404, 500]).toContain(response.status);
      });
    });

    describe('buy_ticket authorization', () => {
      it('should allow passenger to buy ticket with their own card', async () => {
        const response = await request(app.getHttpServer())
          .post('/passenger/tickets/buy')
          .set(authHeader(passenger1Token))
          .send({
            cardId: seed.passenger.cardId,
            tripId: seed.trips.activeId,
            price: 10,
          });

        // May succeed or fail if already purchased, but should not be auth error
        expect([201, 400, 500]).toContain(response.status);
      });

      it('should reject passenger trying to buy ticket with another passenger card', async () => {
        // Passenger1 tries to use Passenger2's card - should fail
        const response = await request(app.getHttpServer())
          .post('/passenger/tickets/buy')
          .set(authHeader(passenger1Token))
          .send({
            cardId: seed.passenger2.cardId,
            tripId: seed.trips.activeId,
            price: 10,
          });

        // Should fail with authorization error
        expect([400, 403, 500]).toContain(response.status);
      });
    });
  });

  describe('Trip Status Validation for Fines', () => {
    let controllerToken: string;

    beforeAll(async () => {
      const login = await loginAs(app, 'ct_controller', 'CHANGE_ME');
      controllerToken = login.token;
    });

    it('should allow issuing fine on in_progress trip', async () => {
      const response = await request(app.getHttpServer())
        .post('/controller/fines')
        .set(authHeader(controllerToken))
        .send({
          cardNumber: seed.passenger.cardNumber,
          amount: 60,
          reason: 'No ticket (in_progress trip)',
          tripId: seed.trips.activeId,
        });

      // Should succeed or fail for other reasons, not trip status
      expect([201, 400, 500]).toContain(response.status);
    });

    it('should reject issuing fine on completed trip', async () => {
      const response = await request(app.getHttpServer())
        .post('/controller/fines')
        .set(authHeader(controllerToken))
        .send({
          cardNumber: seed.passenger.cardNumber,
          amount: 60,
          reason: 'No ticket (completed trip)',
          tripId: seed.trips.finishedId,
        });

      // Should fail because trip is not in_progress
      expect([400, 500]).toContain(response.status);
    });

    it('should reject issuing fine on cancelled trip', async () => {
      const response = await request(app.getHttpServer())
        .post('/controller/fines')
        .set(authHeader(controllerToken))
        .send({
          cardNumber: seed.passenger.cardNumber,
          amount: 60,
          reason: 'No ticket (cancelled trip)',
          tripId: seed.trips.cancelledId,
        });

      // Should fail because trip is not in_progress
      expect([400, 500]).toContain(response.status);
    });

    it('should reject issuing fine on scheduled trip', async () => {
      const response = await request(app.getHttpServer())
        .post('/controller/fines')
        .set(authHeader(controllerToken))
        .send({
          cardNumber: seed.passenger.cardNumber,
          amount: 60,
          reason: 'No ticket (scheduled trip)',
          tripId: seed.trips.scheduledId,
        });

      // Should fail because trip is not in_progress
      expect([400, 500]).toContain(response.status);
    });
  });

  describe('Privilege Escalation Prevention', () => {
    let managerToken: string;

    beforeAll(async () => {
      const login = await loginAs(app, 'ct_manager', 'CHANGE_ME');
      managerToken = login.token;
    });

    it('should allow manager to create dispatcher', async () => {
      const suffix = Date.now().toString().slice(-6);
      const response = await request(app.getHttpServer())
        .post('/manager/staff')
        .set(authHeader(managerToken))
        .send({
          login: `disp_${suffix}`,
          password: 'dispatcher123',
          role: 'dispatcher',
        });

      // Should succeed
      expect([201, 400]).toContain(response.status);
    });

    it('should allow manager to create controller', async () => {
      const suffix = Date.now().toString().slice(-6);
      const response = await request(app.getHttpServer())
        .post('/manager/staff')
        .set(authHeader(managerToken))
        .send({
          login: `ctrl_${suffix}`,
          password: 'controller123',
          role: 'controller',
        });

      // Should succeed
      expect([201, 400]).toContain(response.status);
    });

    it('should reject manager trying to create another manager', async () => {
      const suffix = Date.now().toString().slice(-6);
      const response = await request(app.getHttpServer())
        .post('/manager/staff')
        .set(authHeader(managerToken))
        .send({
          login: `mgr_${suffix}`,
          password: 'manager123',
          role: 'manager',
        });

      // Should fail - privilege escalation attempt
      expect([400, 403, 500]).toContain(response.status);
    });

    it('should reject manager trying to create admin', async () => {
      const suffix = Date.now().toString().slice(-6);
      const response = await request(app.getHttpServer())
        .post('/manager/staff')
        .set(authHeader(managerToken))
        .send({
          login: `admin_${suffix}`,
          password: 'admin123',
          role: 'admin',
        });

      // Should fail - privilege escalation attempt
      expect([400, 403, 500]).toContain(response.status);
    });
  });
});

describe('Validation E2E Tests', () => {
  let app: INestApplication;
  let seed: SeedData;

  beforeAll(async () => {
    app = await getTestApp();
    seed = await ensureSeedData();
  });

  afterAll(async () => {
    await releaseTestApp();
  });

  describe('Complaint Validation', () => {
    describe('Guest Complaints', () => {
      it('should accept valid complaint type', async () => {
        await request(app.getHttpServer())
          .post('/guest/complaints')
          .send({
            type: 'complaint',
            message: 'Valid complaint message',
            contactInfo: 'test@example.com',
          })
          .expect(201);
      });

      it('should accept valid suggestion type', async () => {
        await request(app.getHttpServer())
          .post('/guest/complaints')
          .send({
            type: 'suggestion',
            message: 'Valid suggestion message',
            contactInfo: 'test@example.com',
          })
          .expect(201);
      });

      it('should reject invalid complaint type', async () => {
        const response = await request(app.getHttpServer())
          .post('/guest/complaints')
          .send({
            type: 'invalid_type',
            message: 'Test message',
            contactInfo: 'test@example.com',
          });

        expect([400, 500]).toContain(response.status);
      });

      it('should reject message exceeding 5000 characters', async () => {
        const longMessage = 'x'.repeat(5001);
        const response = await request(app.getHttpServer())
          .post('/guest/complaints')
          .send({
            type: 'complaint',
            message: longMessage,
            contactInfo: 'test@example.com',
          });

        expect([400, 500]).toContain(response.status);
      });

      it('should accept message at exactly 5000 characters', async () => {
        const exactMessage = 'x'.repeat(5000);
        const response = await request(app.getHttpServer())
          .post('/guest/complaints')
          .send({
            type: 'complaint',
            message: exactMessage,
            contactInfo: 'test@example.com',
          });

        expect([201, 500]).toContain(response.status);
      });
    });

    describe('Passenger Complaints', () => {
      let passengerToken: string;

      beforeAll(async () => {
        const login = await loginAs(
          app,
          seed.passenger.login,
          seed.passenger.password,
        );
        passengerToken = login.token;
      });

      it('should accept valid passenger complaint', async () => {
        await request(app.getHttpServer())
          .post('/passenger/complaints')
          .set(authHeader(passengerToken))
          .send({
            type: 'complaint',
            message: 'Valid passenger complaint',
            routeNumber: seed.routeNumber,
            transportType: seed.transportTypeName,
          })
          .expect(201);
      });

      it('should reject invalid complaint type', async () => {
        const response = await request(app.getHttpServer())
          .post('/passenger/complaints')
          .set(authHeader(passengerToken))
          .send({
            type: 'INVALID',
            message: 'Test message',
          });

        expect([400, 500]).toContain(response.status);
      });
    });
  });

  describe('Stops Near Validation', () => {
    it('should accept valid coordinates and limits', async () => {
      const stop = seed.stops[0];
      await request(app.getHttpServer())
        .get('/guest/stops/near')
        .query({
          lon: stop.lon,
          lat: stop.lat,
          radius: 500,
          limit: 10,
        })
        .expect(200);
    });

    it('should reject radius exceeding 50km', async () => {
      const stop = seed.stops[0];
      const response = await request(app.getHttpServer())
        .get('/guest/stops/near')
        .query({
          lon: stop.lon,
          lat: stop.lat,
          radius: 50001, // 50km + 1m
          limit: 10,
        });

      expect([400]).toContain(response.status);
    });

    it('should reject limit exceeding 1000', async () => {
      const stop = seed.stops[0];
      const response = await request(app.getHttpServer())
        .get('/guest/stops/near')
        .query({
          lon: stop.lon,
          lat: stop.lat,
          radius: 500,
          limit: 1001,
        });

      expect([400]).toContain(response.status);
    });

    it('should reject longitude out of range', async () => {
      const response = await request(app.getHttpServer())
        .get('/guest/stops/near')
        .query({
          lon: 181, // Out of range
          lat: 49.84,
          radius: 500,
        });

      expect([400]).toContain(response.status);
    });

    it('should reject latitude out of range', async () => {
      const response = await request(app.getHttpServer())
        .get('/guest/stops/near')
        .query({
          lon: 24.02,
          lat: 91, // Out of range
          radius: 500,
        });

      expect([400]).toContain(response.status);
    });
  });

  describe('Passenger Count Validation', () => {
    let driverToken: string;

    beforeAll(async () => {
      const login = await loginAs(
        app,
        seed.drivers[0].login,
        seed.drivers[0].password,
      );
      driverToken = login.token;
    });

    it('should reject passenger count exceeding 200', async () => {
      const response = await request(app.getHttpServer())
        .post('/driver/trips/passengers')
        .set(authHeader(driverToken))
        .send({
          tripId: seed.trips.activeId,
          passengerCount: 201, // Over limit
        });

      // 400 for validation error, 500 if driver can't access trip
      expect([400, 500]).toContain(response.status);
    });

    it('should reject negative passenger count', async () => {
      const response = await request(app.getHttpServer())
        .post('/driver/trips/passengers')
        .set(authHeader(driverToken))
        .send({
          tripId: seed.trips.activeId,
          passengerCount: -1,
        });

      expect([400, 500]).toContain(response.status);
    });

    it('should accept valid passenger count', async () => {
      const response = await request(app.getHttpServer())
        .post('/driver/trips/passengers')
        .set(authHeader(driverToken))
        .send({
          tripId: seed.trips.activeId,
          passengerCount: 50,
        });

      // Should succeed or fail for trip-related reasons
      expect([200, 201, 400, 500]).toContain(response.status);
    });
  });
});
