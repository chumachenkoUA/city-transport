import { Client } from 'pg';

type StopSeed = {
  id: number;
  name: string;
  lon: number;
  lat: number;
};

type VehicleSeed = {
  id: number;
  fleetNumber: string;
};

type DriverSeed = {
  id: number;
  login: string;
  password: string;
};

type PassengerSeed = {
  id: number;
  login: string;
  password: string;
  cardId: number;
  cardNumber: string;
};

type TripsSeed = {
  finishedId: number;
  activeId: number;
  cancelledId: number;
  scheduledId: number;
};

export type SeedData = {
  transportTypeId: number;
  transportTypeName: string;
  routeId: number;
  routeNumber: string;
  stops: StopSeed[];
  vehicles: VehicleSeed[];
  drivers: DriverSeed[];
  passenger: PassengerSeed;
  passenger2: PassengerSeed; // Second passenger for authorization bypass testing
  trips: TripsSeed;
  fineId: number;
};

let seedCache: SeedData | null = null;
let seedPromise: Promise<SeedData> | null = null;

const PASSWORD = 'CHANGE_ME';

const seedStops: Array<Omit<StopSeed, 'id'>> = [
  { name: 'Stop A', lon: 24.022, lat: 49.842 },
  { name: 'Stop B', lon: 24.028, lat: 49.846 },
];

const seedRoutePoints = [
  { lon: 24.022, lat: 49.842 },
  { lon: 24.025, lat: 49.844 },
  { lon: 24.028, lat: 49.846 },
];

const toNumber = (value: unknown) => Number(value);

export async function ensureSeedData(): Promise<SeedData> {
  if (seedCache) {
    return seedCache;
  }
  if (seedPromise) {
    return seedPromise;
  }

  seedPromise = (async () => {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set for tests');
    }

    const client = new Client({ connectionString });
    await client.connect();

    try {
      await client.query('BEGIN');

      await client.query(`
        DO $$
        BEGIN
          EXECUTE format('GRANT ct_passenger_role TO %I WITH ADMIN OPTION', current_user);
          EXECUTE format('GRANT ct_driver_role TO %I WITH ADMIN OPTION', current_user);
          IF to_regrole('auth_admin') IS NOT NULL THEN
            EXECUTE 'GRANT ct_passenger_role TO auth_admin WITH ADMIN OPTION';
            EXECUTE 'GRANT ct_driver_role TO auth_admin WITH ADMIN OPTION';
          END IF;
          IF to_regrole('ct_migrator') IS NOT NULL THEN
            EXECUTE 'GRANT ct_passenger_role TO ct_migrator WITH ADMIN OPTION';
            EXECUTE 'GRANT ct_driver_role TO ct_migrator WITH ADMIN OPTION';
          END IF;
        END $$;
      `);
      // All views, functions and grants are already created by migrations
      // We only need to seed test data

      // Create staff users (PostgreSQL roles) for testing
      const staffUsers = [
        { login: 'ct_manager', role: 'ct_manager_role' },
        { login: 'ct_controller', role: 'ct_controller_role' },
        { login: 'ct_dispatcher', role: 'ct_dispatcher_role' },
        { login: 'ct_accountant', role: 'ct_accountant_role' },
        { login: 'ct_municipality', role: 'ct_municipality_role' },
      ];

      for (const staff of staffUsers) {
        const roleExists = await client.query(
          `SELECT 1 FROM pg_roles WHERE rolname = $1`,
          [staff.login],
        );
        if (!roleExists.rows[0]) {
          await client.query(
            `CREATE ROLE ${staff.login} LOGIN PASSWORD '${PASSWORD}'`,
          );
          await client.query(`GRANT ${staff.role} TO ${staff.login}`);
        }
      }

      // Create passenger PostgreSQL roles
      const passengerLogins = ['pupkin', 'pupkin2'];
      for (const login of passengerLogins) {
        const roleExists = await client.query(
          `SELECT 1 FROM pg_roles WHERE rolname = $1`,
          [login],
        );
        if (!roleExists.rows[0]) {
          await client.query(`CREATE ROLE ${login} LOGIN PASSWORD '${PASSWORD}'`);
          await client.query(`GRANT ct_passenger_role TO ${login}`);
        }
      }

      // Create driver PostgreSQL roles
      const driverLogins = ['driver1', 'driver2'];
      for (const login of driverLogins) {
        const roleExists = await client.query(
          `SELECT 1 FROM pg_roles WHERE rolname = $1`,
          [login],
        );
        if (!roleExists.rows[0]) {
          await client.query(`CREATE ROLE ${login} LOGIN PASSWORD '${PASSWORD}'`);
          await client.query(`GRANT ct_driver_role TO ${login}`);
        }
      }

      const transportTypeName = 'Bus';
      await client.query(
        'INSERT INTO public.transport_types (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [transportTypeName],
      );
      const transportTypeResult = await client.query<{ id: number }>(
        'SELECT id FROM public.transport_types WHERE name = $1',
        [transportTypeName],
      );
      const transportTypeId = toNumber(transportTypeResult.rows[0]?.id);

      const routeNumber = '10';
      await client.query(
        'INSERT INTO public.routes (transport_type_id, number, direction, is_active) VALUES ($1, $2, $3, true) ON CONFLICT (transport_type_id, number, direction) DO NOTHING',
        [transportTypeId, routeNumber, 'forward'],
      );
      const routeResult = await client.query<{ id: number }>(
        'SELECT id FROM public.routes WHERE transport_type_id = $1 AND number = $2 AND direction = $3',
        [transportTypeId, routeNumber, 'forward'],
      );
      const routeId = toNumber(routeResult.rows[0]?.id);

      const stops: StopSeed[] = [];
      for (const stop of seedStops) {
        await client.query(
          'INSERT INTO public.stops (name, lon, lat) VALUES ($1, $2, $3) ON CONFLICT (name, lon, lat) DO NOTHING',
          [stop.name, stop.lon, stop.lat],
        );
        const stopResult = await client.query<{ id: number }>(
          'SELECT id FROM public.stops WHERE name = $1 AND lon = $2 AND lat = $3',
          [stop.name, stop.lon, stop.lat],
        );
        stops.push({
          id: toNumber(stopResult.rows[0]?.id),
          name: stop.name,
          lon: stop.lon,
          lat: stop.lat,
        });
      }

      const routeStopsResult = await client.query<{ id: number }>(
        'SELECT id FROM public.route_stops WHERE route_id = $1',
        [routeId],
      );
      if (routeStopsResult.rows.length === 0) {
        let prevRouteStopId: number | null = null;
        for (let i = 0; i < stops.length; i += 1) {
          const stop = stops[i];
          const distanceToNextKm = i < stops.length - 1 ? 0.6 : null;
          const inserted = await client.query<{ id: number }>(
            'INSERT INTO public.route_stops (route_id, stop_id, prev_route_stop_id, distance_to_next_km) VALUES ($1, $2, $3, $4) RETURNING id',
            [routeId, stop.id, prevRouteStopId, distanceToNextKm],
          );
          const routeStopId = toNumber(inserted.rows[0]?.id);
          if (prevRouteStopId) {
            await client.query(
              'UPDATE public.route_stops SET next_route_stop_id = $1 WHERE id = $2',
              [routeStopId, prevRouteStopId],
            );
          }
          prevRouteStopId = routeStopId;
        }
      }

      const routePointsResult = await client.query<{ id: number }>(
        'SELECT id FROM public.route_points WHERE route_id = $1',
        [routeId],
      );
      if (routePointsResult.rows.length === 0) {
        let prevRoutePointId: number | null = null;
        for (const point of seedRoutePoints) {
          const inserted = await client.query<{ id: number }>(
            'INSERT INTO public.route_points (route_id, lon, lat, prev_route_point_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [routeId, point.lon, point.lat, prevRoutePointId],
          );
          const routePointId = toNumber(inserted.rows[0]?.id);
          if (prevRoutePointId) {
            await client.query(
              'UPDATE public.route_points SET next_route_point_id = $1 WHERE id = $2',
              [routePointId, prevRoutePointId],
            );
          }
          prevRoutePointId = routePointId;
        }
      }

      const scheduleResult = await client.query<{ id: number }>(
        'SELECT id FROM public.schedules WHERE route_id = $1 LIMIT 1',
        [routeId],
      );
      if (scheduleResult.rows.length === 0) {
        await client.query(
          `INSERT INTO public.schedules
            (route_id, work_start_time, work_end_time, interval_min, monday, tuesday, wednesday, thursday, friday)
           VALUES ($1, $2, $3, $4, true, true, true, true, true)`,
          [routeId, '06:00', '22:00', 10],
        );
      }

      const modelResult = await client.query<{ id: number }>(
        'SELECT id FROM public.vehicle_models WHERE name = $1 AND type_id = $2 AND capacity = $3 LIMIT 1',
        ['Test Model', transportTypeId, 50],
      );
      let modelId = toNumber(modelResult.rows[0]?.id);
      if (!modelId) {
        const inserted = await client.query<{ id: number }>(
          'INSERT INTO public.vehicle_models (name, type_id, capacity) VALUES ($1, $2, $3) RETURNING id',
          ['Test Model', transportTypeId, 50],
        );
        modelId = toNumber(inserted.rows[0]?.id);
      }

      const vehicleSeeds = ['BUS-1', 'BUS-2'];
      const vehicles: VehicleSeed[] = [];
      for (const fleetNumber of vehicleSeeds) {
        await client.query(
          'INSERT INTO public.vehicles (fleet_number, vehicle_model_id, route_id) VALUES ($1, $2, $3) ON CONFLICT (fleet_number) DO NOTHING',
          [fleetNumber, modelId, routeId],
        );
        const vehicleResult = await client.query<{ id: number }>(
          'SELECT id FROM public.vehicles WHERE fleet_number = $1',
          [fleetNumber],
        );
        vehicles.push({
          id: toNumber(vehicleResult.rows[0]?.id),
          fleetNumber,
        });
      }

      const driversData = [
        {
          login: 'driver1',
          email: 'driver1@test.local',
          phone: '+380000000001',
          fullName: 'Driver One',
          license: 'D-0001',
        },
        {
          login: 'driver2',
          email: 'driver2@test.local',
          phone: '+380000000002',
          fullName: 'Driver Two',
          license: 'D-0002',
        },
      ];

      const drivers: DriverSeed[] = [];
      for (const driver of driversData) {
        const existing = await client.query<{ id: number }>(
          'SELECT id FROM public.drivers WHERE login = $1',
          [driver.login],
        );
        let driverId = toNumber(existing.rows[0]?.id);
        if (!driverId) {
          const inserted = await client.query<{ id: number }>(
            `INSERT INTO public.drivers
              (login, email, phone, full_name, driver_license_number, license_categories, passport_data)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id`,
            [
              driver.login,
              driver.email,
              driver.phone,
              driver.fullName,
              driver.license,
              JSON.stringify(['D']),
              JSON.stringify({ series: 'AA', number: driver.license }),
            ],
          );
          driverId = toNumber(inserted.rows[0]?.id);
        }
        drivers.push({ id: driverId, login: driver.login, password: PASSWORD });
      }

      const passengerLogin = 'pupkin';
      const passengerEmail = 'pupkin@test.local';
      const passengerPhone = '+380000000010';

      const passengerResult = await client.query<{ id: number }>(
        'SELECT id FROM public.users WHERE login = $1',
        [passengerLogin],
      );
      let passengerId = toNumber(passengerResult.rows[0]?.id);
      if (!passengerId) {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO public.users (login, email, phone, full_name)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [passengerLogin, passengerEmail, passengerPhone, 'Passenger Pupkin'],
        );
        passengerId = toNumber(inserted.rows[0]?.id);
      }

      const existingCard = await client.query<{
        id: number;
        card_number: string;
      }>(
        'SELECT id, card_number FROM public.transport_cards WHERE user_id = $1 LIMIT 1',
        [passengerId],
      );
      let cardId = toNumber(existingCard.rows[0]?.id);
      const cardNumber =
        existingCard.rows[0]?.card_number ?? `CARD-${passengerId}`;

      if (!cardId) {
        const inserted = await client.query<{ id: number }>(
          'INSERT INTO public.transport_cards (user_id, balance, card_number) VALUES ($1, $2, $3) RETURNING id',
          [passengerId, 100, cardNumber],
        );
        cardId = toNumber(inserted.rows[0]?.id);
      } else {
        await client.query(
          'UPDATE public.transport_cards SET balance = GREATEST(balance, 100) WHERE id = $1',
          [cardId],
        );
      }

      // Create second passenger for authorization bypass testing
      const passenger2Login = 'pupkin2';
      const passenger2Email = 'pupkin2@test.local';
      const passenger2Phone = '+380000000011';

      const passenger2Result = await client.query<{ id: number }>(
        'SELECT id FROM public.users WHERE login = $1',
        [passenger2Login],
      );
      let passenger2Id = toNumber(passenger2Result.rows[0]?.id);
      if (!passenger2Id) {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO public.users (login, email, phone, full_name)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [
            passenger2Login,
            passenger2Email,
            passenger2Phone,
            'Passenger Pupkin2',
          ],
        );
        passenger2Id = toNumber(inserted.rows[0]?.id);
      }

      const existingCard2 = await client.query<{
        id: number;
        card_number: string;
      }>(
        'SELECT id, card_number FROM public.transport_cards WHERE user_id = $1 LIMIT 1',
        [passenger2Id],
      );
      let card2Id = toNumber(existingCard2.rows[0]?.id);
      const card2Number =
        existingCard2.rows[0]?.card_number ?? `CARD-${passenger2Id}`;

      if (!card2Id) {
        const inserted = await client.query<{ id: number }>(
          'INSERT INTO public.transport_cards (user_id, balance, card_number) VALUES ($1, $2, $3) RETURNING id',
          [passenger2Id, 50, card2Number],
        );
        card2Id = toNumber(inserted.rows[0]?.id);
      }

      const assignments = [
        { driverId: drivers[0].id, vehicleId: vehicles[0].id },
        { driverId: drivers[1].id, vehicleId: vehicles[1].id },
      ];
      for (const assignment of assignments) {
        const exists = await client.query<{ id: number }>(
          'SELECT id FROM public.driver_vehicle_assignments WHERE driver_id = $1 AND vehicle_id = $2 LIMIT 1',
          [assignment.driverId, assignment.vehicleId],
        );
        if (!exists.rows[0]) {
          await client.query(
            'INSERT INTO public.driver_vehicle_assignments (driver_id, vehicle_id, assigned_at) VALUES ($1, $2, now())',
            [assignment.driverId, assignment.vehicleId],
          );
        }
      }

      const now = new Date();

      // Finished/completed trip
      const finishedTripResult = await client.query<{ id: number }>(
        'SELECT id FROM public.trips WHERE driver_id = $1 AND status = $2 ORDER BY actual_ends_at DESC LIMIT 1',
        [drivers[0].id, 'completed'],
      );
      let finishedTripId = toNumber(finishedTripResult.rows[0]?.id);
      if (!finishedTripId) {
        const plannedStartsAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        const plannedEndsAt = new Date(now.getTime() - 1 * 60 * 60 * 1000);
        const actualStartsAt = plannedStartsAt;
        const actualEndsAt = plannedEndsAt;
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO public.trips
            (route_id, driver_id, planned_starts_at, planned_ends_at, actual_starts_at, actual_ends_at, status, passenger_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            routeId,
            drivers[0].id,
            plannedStartsAt,
            plannedEndsAt,
            actualStartsAt,
            actualEndsAt,
            'completed',
            12,
          ],
        );
        finishedTripId = toNumber(inserted.rows[0]?.id);
      }

      // Active/in_progress trip
      const activeTripResult = await client.query<{ id: number }>(
        'SELECT id FROM public.trips WHERE driver_id = $1 AND status = $2 ORDER BY actual_starts_at DESC LIMIT 1',
        [drivers[1].id, 'in_progress'],
      );
      let activeTripId = toNumber(activeTripResult.rows[0]?.id);
      if (!activeTripId) {
        const plannedStartsAt = new Date(now.getTime() - 30 * 60 * 1000);
        const plannedEndsAt = new Date(now.getTime() + 30 * 60 * 1000);
        const actualStartsAt = plannedStartsAt;
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO public.trips
            (route_id, driver_id, planned_starts_at, planned_ends_at, actual_starts_at, status, passenger_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            routeId,
            drivers[1].id,
            plannedStartsAt,
            plannedEndsAt,
            actualStartsAt,
            'in_progress',
            8,
          ],
        );
        activeTripId = toNumber(inserted.rows[0]?.id);
      }

      // Cancelled trip (for testing issue_fine should fail on non in_progress trips)
      const cancelledTripResult = await client.query<{ id: number }>(
        'SELECT id FROM public.trips WHERE driver_id = $1 AND status = $2 ORDER BY planned_starts_at DESC LIMIT 1',
        [drivers[0].id, 'cancelled'],
      );
      let cancelledTripId = toNumber(cancelledTripResult.rows[0]?.id);
      if (!cancelledTripId) {
        const plannedStartsAt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
        const plannedEndsAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO public.trips
            (route_id, driver_id, planned_starts_at, planned_ends_at, status, passenger_count)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            routeId,
            drivers[0].id,
            plannedStartsAt,
            plannedEndsAt,
            'cancelled',
            0,
          ],
        );
        cancelledTripId = toNumber(inserted.rows[0]?.id);
      }

      // Scheduled trip (for testing issue_fine should fail on non in_progress trips)
      const scheduledTripResult = await client.query<{ id: number }>(
        'SELECT id FROM public.trips WHERE driver_id = $1 AND status = $2 ORDER BY planned_starts_at DESC LIMIT 1',
        [drivers[0].id, 'scheduled'],
      );
      let scheduledTripId = toNumber(scheduledTripResult.rows[0]?.id);
      if (!scheduledTripId) {
        const plannedStartsAt = new Date(now.getTime() + 60 * 60 * 1000);
        const plannedEndsAt = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO public.trips
            (route_id, driver_id, planned_starts_at, planned_ends_at, status, passenger_count)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id`,
          [
            routeId,
            drivers[0].id,
            plannedStartsAt,
            plannedEndsAt,
            'scheduled',
            0,
          ],
        );
        scheduledTripId = toNumber(inserted.rows[0]?.id);
      }

      const gpsResult = await client.query<{ id: number }>(
        'SELECT id FROM public.vehicle_gps_logs WHERE vehicle_id = $1 ORDER BY recorded_at DESC LIMIT 1',
        [vehicles[1].id],
      );
      if (!gpsResult.rows[0]) {
        await client.query(
          `INSERT INTO public.vehicle_gps_logs
            (vehicle_id, lon, lat, recorded_at)
           VALUES ($1, $2, $3, $4)`,
          [vehicles[1].id, 24.025, 49.844, now],
        );
      }

      const ticketResult = await client.query<{ id: number }>(
        'SELECT id FROM public.tickets WHERE card_id = $1 ORDER BY purchased_at DESC LIMIT 1',
        [cardId],
      );
      if (!ticketResult.rows[0]) {
        await client.query(
          `INSERT INTO public.tickets
            (trip_id, card_id, price, purchased_at)
           VALUES ($1, $2, $3, $4)`,
          [finishedTripId, cardId, 12, now],
        );
      }

      const fineResult = await client.query<{ id: number }>(
        'SELECT id FROM public.fines WHERE user_id = $1 ORDER BY issued_at DESC LIMIT 1',
        [passengerId],
      );
      let fineId = toNumber(fineResult.rows[0]?.id);
      if (!fineId) {
        const inserted = await client.query<{ id: number }>(
          `INSERT INTO public.fines
            (user_id, status, amount, reason, issued_by, trip_id, issued_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING id`,
          [
            passengerId,
            'Очікує сплати',
            50,
            'Test fine',
            'seed',
            finishedTripId,
            now,
          ],
        );
        fineId = toNumber(inserted.rows[0]?.id);
      }
      if (fineId) {
        await client.query(
          'DELETE FROM public.fine_appeals WHERE fine_id = $1',
          [fineId],
        );
      }

      const complaintExists = await client.query<{ id: number }>(
        'SELECT id FROM public.complaints_suggestions WHERE message = $1 LIMIT 1',
        ['Test complaint'],
      );
      if (!complaintExists.rows[0]) {
        await client.query(
          `INSERT INTO public.complaints_suggestions
            (user_id, type, message, status, created_at, route_id, vehicle_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            passengerId,
            'complaint',
            'Test complaint',
            'Подано',
            now,
            routeId,
            vehicles[1].id,
          ],
        );
      }

      await client.query('COMMIT');

      const seedData: SeedData = {
        transportTypeId,
        transportTypeName,
        routeId,
        routeNumber,
        stops,
        vehicles,
        drivers,
        passenger: {
          id: passengerId,
          login: passengerLogin,
          password: PASSWORD,
          cardId,
          cardNumber,
        },
        passenger2: {
          id: passenger2Id,
          login: passenger2Login,
          password: PASSWORD,
          cardId: card2Id,
          cardNumber: card2Number,
        },
        trips: {
          finishedId: finishedTripId,
          activeId: activeTripId,
          cancelledId: cancelledTripId,
          scheduledId: scheduledTripId,
        },
        fineId,
      };

      seedCache = seedData;
      return seedData;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      await client.end();
    }
  })();

  seedCache = await seedPromise;
  return seedCache;
}
