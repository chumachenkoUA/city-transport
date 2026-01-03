import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { seed as drizzleSeed } from 'drizzle-seed';
import {
  cardTopUps,
  complaintsSuggestions,
  driverVehicleAssignments,
  drivers,
  fineAppeals,
  fines,
  routePoints,
  routeStops,
  routes,
  schedules,
  stops,
  tickets,
  transportCards,
  transportTypes,
  trips,
  userGpsLogs,
  users,
  vehicleGpsLogs,
  vehicles,
} from './db/schema';

const TRUNCATE_SQL =
  'TRUNCATE TABLE "complaints_suggestions", "fine_appeals", "fines", "tickets", "card_top_ups", "transport_cards", "trips", "driver_vehicle_assignments", "vehicle_gps_logs", "user_gps_logs", "route_points", "route_stops", "vehicles", "schedules", "routes", "transport_types", "stops", "drivers", "users" RESTART IDENTITY CASCADE';

const SETVAL_STATEMENTS = [
  "SELECT setval(pg_get_serial_sequence('users','id'), COALESCE((SELECT MAX(id) FROM users), 1), true)",
  "SELECT setval(pg_get_serial_sequence('drivers','id'), COALESCE((SELECT MAX(id) FROM drivers), 1), true)",
  "SELECT setval(pg_get_serial_sequence('stops','id'), COALESCE((SELECT MAX(id) FROM stops), 1), true)",
  "SELECT setval(pg_get_serial_sequence('transport_types','id'), COALESCE((SELECT MAX(id) FROM transport_types), 1), true)",
  "SELECT setval(pg_get_serial_sequence('routes','id'), COALESCE((SELECT MAX(id) FROM routes), 1), true)",
  "SELECT setval(pg_get_serial_sequence('route_stops','id'), COALESCE((SELECT MAX(id) FROM route_stops), 1), true)",
  "SELECT setval(pg_get_serial_sequence('route_points','id'), COALESCE((SELECT MAX(id) FROM route_points), 1), true)",
  "SELECT setval(pg_get_serial_sequence('vehicles','id'), COALESCE((SELECT MAX(id) FROM vehicles), 1), true)",
  "SELECT setval(pg_get_serial_sequence('driver_vehicle_assignments','id'), COALESCE((SELECT MAX(id) FROM driver_vehicle_assignments), 1), true)",
  "SELECT setval(pg_get_serial_sequence('schedules','id'), COALESCE((SELECT MAX(id) FROM schedules), 1), true)",
  "SELECT setval(pg_get_serial_sequence('trips','id'), COALESCE((SELECT MAX(id) FROM trips), 1), true)",
  "SELECT setval(pg_get_serial_sequence('transport_cards','id'), COALESCE((SELECT MAX(id) FROM transport_cards), 1), true)",
  "SELECT setval(pg_get_serial_sequence('card_top_ups','id'), COALESCE((SELECT MAX(id) FROM card_top_ups), 1), true)",
  "SELECT setval(pg_get_serial_sequence('tickets','id'), COALESCE((SELECT MAX(id) FROM tickets), 1), true)",
  "SELECT setval(pg_get_serial_sequence('fines','id'), COALESCE((SELECT MAX(id) FROM fines), 1), true)",
  "SELECT setval(pg_get_serial_sequence('fine_appeals','id'), COALESCE((SELECT MAX(id) FROM fine_appeals), 1), true)",
  "SELECT setval(pg_get_serial_sequence('complaints_suggestions','id'), COALESCE((SELECT MAX(id) FROM complaints_suggestions), 1), true)",
  "SELECT setval(pg_get_serial_sequence('user_gps_logs','id'), COALESCE((SELECT MAX(id) FROM user_gps_logs), 1), true)",
  "SELECT setval(pg_get_serial_sequence('vehicle_gps_logs','id'), COALESCE((SELECT MAX(id) FROM vehicle_gps_logs), 1), true)",
];

export async function seedDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool);

  try {
    if (process.env.SEED_RESET === 'true') {
      await db.execute(sql.raw(TRUNCATE_SQL));
    }

    const pad2 = (value: number) => `${value}`.padStart(2, '0');
    const formatDate = (date: Date) =>
      `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    const formatTime = (date: Date) =>
      `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(
        date.getSeconds(),
      )}`;
    const withTime = (base: Date, time: string) => {
      const [hours, minutes, seconds] = time.split(':').map(Number);
      const date = new Date(base);
      date.setHours(hours || 0, minutes || 0, seconds || 0, 0);
      return date;
    };
    const ts = (value: string) => sql.raw(`timestamp '${value}'`);
    const tsAt = (date: Date, time: string) =>
      ts(`${formatDate(date)} ${time}`);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const seedTimestamp = tsAt(today, formatTime(now));

    const seedRandomEnabled = process.env.SEED_RANDOM !== 'false';

    await db.transaction(async (tx) => {
      await tx
        .insert(drivers)
        .values([
          {
            id: 1,
            login: 'driver1',
            email: 'driver1@example.com',
            phone: '+380971112233',
            fullName: 'Сидоренко Петро Іванович',
            driverLicenseNumber: 'KP123456',
            licenseCategories: ['B', 'C'],
            passportData: { number: '123456', series: 'AB' },
          },
          {
            id: 2,
            login: 'driver2',
            email: 'driver2@example.com',
            phone: '+380972223344',
            fullName: 'Коваль Андрій Петрович',
            driverLicenseNumber: 'KP654321',
            licenseCategories: ['B', 'D'],
            passportData: { number: '654321', series: 'AB' },
          },
          {
            id: 3,
            login: 'driver3',
            email: 'driver3@example.com',
            phone: '+380973334455',
            fullName: 'Мельник Ігор Васильович',
            driverLicenseNumber: 'KP777888',
            licenseCategories: ['C', 'D'],
            passportData: { number: '777888', series: 'BC' },
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(stops)
        .values([
          {
            id: 1,
            name: 'Центральна площа',
            lon: '30.5000',
            lat: '50.4000',
          },
          { id: 2, name: 'Вокзал', lon: '30.5600', lat: '50.4500' },
          { id: 3, name: 'Магазин', lon: '30.6200', lat: '50.5000' },
          { id: 4, name: 'Університет', lon: '30.6800', lat: '50.5500' },
          { id: 5, name: 'Парк', lon: '30.7400', lat: '50.6000' },
          { id: 7, name: 'Депо', lon: '30.8000', lat: '50.6500' },
          { id: 8, name: 'Музей', lon: '30.8600', lat: '50.7000' },
          { id: 9, name: 'Технопарк', lon: '30.9200', lat: '50.7500' },
          { id: 10, name: 'Ринок', lon: '30.9800', lat: '50.8000' },
          { id: 11, name: 'Стадіон', lon: '31.0400', lat: '50.8500' },
          { id: 12, name: 'Аеропорт', lon: '31.1000', lat: '50.9000' },
        ])
        .onConflictDoNothing();

      await tx
        .insert(transportTypes)
        .values([
          { id: 1, name: 'Автобус' },
          { id: 2, name: 'Трамвай' },
          { id: 3, name: 'Тролейбус' },
        ])
        .onConflictDoNothing();

      await tx
        .insert(routes)
        .values([
          {
            id: 1,
            transportTypeId: 1,
            number: '12',
            direction: 'forward',
            isActive: true,
          },
          {
            id: 11,
            transportTypeId: 1,
            number: '12',
            direction: 'reverse',
            isActive: true,
          },
          {
            id: 2,
            transportTypeId: 3,
            number: '5',
            direction: 'forward',
            isActive: true,
          },
          {
            id: 6,
            transportTypeId: 1,
            number: '24',
            direction: 'forward',
            isActive: true,
          },
          {
            id: 7,
            transportTypeId: 2,
            number: '3',
            direction: 'forward',
            isActive: true,
          },
          {
            id: 8,
            transportTypeId: 2,
            number: '8',
            direction: 'forward',
            isActive: true,
          },
          {
            id: 9,
            transportTypeId: 3,
            number: '11',
            direction: 'forward',
            isActive: true,
          },
          {
            id: 10,
            transportTypeId: 1,
            number: '33',
            direction: 'forward',
            isActive: true,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(routeStops)
        .values([
          {
            id: 1,
            routeId: 1,
            stopId: 1,
            prevRouteStopId: null,
            nextRouteStopId: 2,
            distanceToNextKm: '7.000',
          },
          {
            id: 2,
            routeId: 1,
            stopId: 2,
            prevRouteStopId: 1,
            nextRouteStopId: 3,
            distanceToNextKm: '7.000',
          },
          {
            id: 3,
            routeId: 1,
            stopId: 3,
            prevRouteStopId: 2,
            nextRouteStopId: 4,
            distanceToNextKm: '7.000',
          },
          {
            id: 4,
            routeId: 1,
            stopId: 4,
            prevRouteStopId: 3,
            nextRouteStopId: 5,
            distanceToNextKm: '7.000',
          },
          {
            id: 5,
            routeId: 1,
            stopId: 5,
            prevRouteStopId: 4,
            nextRouteStopId: 6,
            distanceToNextKm: '7.000',
          },
          {
            id: 6,
            routeId: 1,
            stopId: 7,
            prevRouteStopId: 5,
            nextRouteStopId: 7,
            distanceToNextKm: '7.000',
          },
          {
            id: 7,
            routeId: 1,
            stopId: 8,
            prevRouteStopId: 6,
            nextRouteStopId: 8,
            distanceToNextKm: '7.000',
          },
          {
            id: 8,
            routeId: 1,
            stopId: 9,
            prevRouteStopId: 7,
            nextRouteStopId: null,
            distanceToNextKm: null,
          },
          {
            id: 101,
            routeId: 11,
            stopId: 9,
            prevRouteStopId: null,
            nextRouteStopId: 102,
            distanceToNextKm: '7.000',
          },
          {
            id: 102,
            routeId: 11,
            stopId: 8,
            prevRouteStopId: 101,
            nextRouteStopId: 103,
            distanceToNextKm: '7.000',
          },
          {
            id: 103,
            routeId: 11,
            stopId: 7,
            prevRouteStopId: 102,
            nextRouteStopId: 104,
            distanceToNextKm: '7.000',
          },
          {
            id: 104,
            routeId: 11,
            stopId: 5,
            prevRouteStopId: 103,
            nextRouteStopId: 105,
            distanceToNextKm: '7.000',
          },
          {
            id: 105,
            routeId: 11,
            stopId: 4,
            prevRouteStopId: 104,
            nextRouteStopId: 106,
            distanceToNextKm: '7.000',
          },
          {
            id: 106,
            routeId: 11,
            stopId: 3,
            prevRouteStopId: 105,
            nextRouteStopId: 107,
            distanceToNextKm: '7.000',
          },
          {
            id: 107,
            routeId: 11,
            stopId: 2,
            prevRouteStopId: 106,
            nextRouteStopId: 108,
            distanceToNextKm: '7.000',
          },
          {
            id: 108,
            routeId: 11,
            stopId: 1,
            prevRouteStopId: 107,
            nextRouteStopId: null,
            distanceToNextKm: null,
          },
          {
            id: 12,
            routeId: 2,
            stopId: 1,
            prevRouteStopId: null,
            nextRouteStopId: 13,
            distanceToNextKm: '0.488',
          },
          {
            id: 13,
            routeId: 2,
            stopId: 4,
            prevRouteStopId: 12,
            nextRouteStopId: 14,
            distanceToNextKm: '2.078',
          },
          {
            id: 14,
            routeId: 2,
            stopId: 2,
            prevRouteStopId: 13,
            nextRouteStopId: 15,
            distanceToNextKm: '0.633',
          },
          {
            id: 15,
            routeId: 2,
            stopId: 10,
            prevRouteStopId: 14,
            nextRouteStopId: null,
            distanceToNextKm: null,
          },
          {
            id: 16,
            routeId: 6,
            stopId: 1,
            prevRouteStopId: null,
            nextRouteStopId: 17,
            distanceToNextKm: '1.594',
          },
          {
            id: 17,
            routeId: 6,
            stopId: 2,
            prevRouteStopId: 16,
            nextRouteStopId: 18,
            distanceToNextKm: '0.633',
          },
          {
            id: 18,
            routeId: 6,
            stopId: 10,
            prevRouteStopId: 17,
            nextRouteStopId: 19,
            distanceToNextKm: '2.272',
          },
          {
            id: 19,
            routeId: 6,
            stopId: 7,
            prevRouteStopId: 18,
            nextRouteStopId: null,
            distanceToNextKm: null,
          },
          {
            id: 20,
            routeId: 7,
            stopId: 1,
            prevRouteStopId: null,
            nextRouteStopId: 21,
            distanceToNextKm: '0.147',
          },
          {
            id: 21,
            routeId: 7,
            stopId: 8,
            prevRouteStopId: 20,
            nextRouteStopId: 22,
            distanceToNextKm: '0.365',
          },
          {
            id: 22,
            routeId: 7,
            stopId: 4,
            prevRouteStopId: 21,
            nextRouteStopId: 23,
            distanceToNextKm: '0.969',
          },
          {
            id: 23,
            routeId: 7,
            stopId: 11,
            prevRouteStopId: 22,
            nextRouteStopId: null,
            distanceToNextKm: null,
          },
          {
            id: 24,
            routeId: 8,
            stopId: 2,
            prevRouteStopId: null,
            nextRouteStopId: 25,
            distanceToNextKm: '1.734',
          },
          {
            id: 25,
            routeId: 8,
            stopId: 8,
            prevRouteStopId: 24,
            nextRouteStopId: 26,
            distanceToNextKm: '1.763',
          },
          {
            id: 26,
            routeId: 8,
            stopId: 9,
            prevRouteStopId: 25,
            nextRouteStopId: 27,
            distanceToNextKm: '6.131',
          },
          {
            id: 27,
            routeId: 8,
            stopId: 12,
            prevRouteStopId: 26,
            nextRouteStopId: null,
            distanceToNextKm: null,
          },
          {
            id: 28,
            routeId: 9,
            stopId: 1,
            prevRouteStopId: null,
            nextRouteStopId: 29,
            distanceToNextKm: '0.849',
          },
          {
            id: 29,
            routeId: 9,
            stopId: 5,
            prevRouteStopId: 28,
            nextRouteStopId: 30,
            distanceToNextKm: '1.044',
          },
          {
            id: 30,
            routeId: 9,
            stopId: 9,
            prevRouteStopId: 29,
            nextRouteStopId: 31,
            distanceToNextKm: '6.131',
          },
          {
            id: 31,
            routeId: 9,
            stopId: 12,
            prevRouteStopId: 30,
            nextRouteStopId: null,
            distanceToNextKm: null,
          },
          {
            id: 32,
            routeId: 10,
            stopId: 3,
            prevRouteStopId: null,
            nextRouteStopId: 33,
            distanceToNextKm: '1.731',
          },
          {
            id: 33,
            routeId: 10,
            stopId: 11,
            prevRouteStopId: 32,
            nextRouteStopId: 34,
            distanceToNextKm: '7.283',
          },
          {
            id: 34,
            routeId: 10,
            stopId: 12,
            prevRouteStopId: 33,
            nextRouteStopId: 35,
            distanceToNextKm: '8.173',
          },
          {
            id: 35,
            routeId: 10,
            stopId: 2,
            prevRouteStopId: 34,
            nextRouteStopId: null,
            distanceToNextKm: null,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(users)
        .values([
          {
            id: 1,
            login: 'pupkin',
            email: 'pupkin@example.com',
            phone: '+380991112233',
            fullName: 'Пупкін Василь Олександрович',
            registeredAt: seedTimestamp,
          },
          {
            id: 2,
            login: 'ivanova',
            email: 'ivanova@example.com',
            phone: '+380992223344',
            fullName: 'Іванова Марія Сергіївна',
            registeredAt: seedTimestamp,
          },
          {
            id: 3,
            login: 'bondar',
            email: 'bondar@example.com',
            phone: '+380993334455',
            fullName: 'Бондар Олег Ігорович',
            registeredAt: seedTimestamp,
          },
          {
            id: 4,
            login: 'shevchenko',
            email: 'shevchenko@example.com',
            phone: '+380994445566',
            fullName: 'Шевченко Олена Петрівна',
            registeredAt: seedTimestamp,
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(vehicles)
        .values([
          {
            id: 1,
            fleetNumber: 'AB-001',
            transportTypeId: 1,
            capacity: 50,
            routeId: 1,
          },
          {
            id: 2,
            fleetNumber: 'AB-002',
            transportTypeId: 1,
            capacity: 50,
            routeId: 1,
          },
          {
            id: 3,
            fleetNumber: 'TB-101',
            transportTypeId: 3,
            capacity: 80,
            routeId: 2,
          },
          {
            id: 4,
            fleetNumber: 'TR-202',
            transportTypeId: 2,
            capacity: 170,
            routeId: 8,
          },
          {
            id: 5,
            fleetNumber: 'TB-102',
            transportTypeId: 3,
            capacity: 90,
            routeId: 2,
          },
          {
            id: 6,
            fleetNumber: 'TB-103',
            transportTypeId: 3,
            capacity: 85,
            routeId: 9,
          },
          {
            id: 7,
            fleetNumber: 'AB-003',
            transportTypeId: 1,
            capacity: 48,
            routeId: 6,
          },
          {
            id: 8,
            fleetNumber: 'AB-004',
            transportTypeId: 1,
            capacity: 60,
            routeId: 10,
          },
          {
            id: 9,
            fleetNumber: 'TR-201',
            transportTypeId: 2,
            capacity: 180,
            routeId: 7,
          },
          {
            id: 10,
            fleetNumber: 'AB-005',
            transportTypeId: 1,
            capacity: 52,
            routeId: 6,
          },
          {
            id: 11,
            fleetNumber: 'AB-006',
            transportTypeId: 1,
            capacity: 50,
            routeId: 6,
          },
          {
            id: 12,
            fleetNumber: 'AB-007',
            transportTypeId: 1,
            capacity: 60,
            routeId: 6,
          },
        ])
        .onConflictDoNothing();

      const tripValues = (() => {
        const fixedTripTimes = [
          '06:00:00',
          '08:15:00',
          '10:30:00',
          '14:00:00',
          '16:15:00',
          '18:30:00',
        ];
        const forwardRouteId = 1;
        const reverseRouteId = 11;
        const tripDriverId = 1;
        const tripVehicleId = 1;
        const tripDurationMin = 120;

        const startOfDay = new Date(today);
        startOfDay.setHours(0, 0, 0, 0);

        const fixedStarts = fixedTripTimes.map((time) =>
          withTime(today, time),
        );
        const hasActiveSlot = fixedStarts.some((start) => {
          const end = new Date(start.getTime() + tripDurationMin * 60 * 1000);
          return now >= start && now <= end;
        });

        let activeStart = new Date(now.getTime() - 20 * 60 * 1000);
        if (activeStart < startOfDay) {
          activeStart = new Date(startOfDay.getTime() + 5 * 60 * 1000);
        }

        const uniqueStarts = new Map<string, Date>();
        fixedTripTimes.forEach((time, index) => {
          uniqueStarts.set(time, fixedStarts[index]);
        });
        if (!hasActiveSlot) {
          const activeTime = formatTime(activeStart);
          if (!uniqueStarts.has(activeTime)) {
            uniqueStarts.set(activeTime, activeStart);
          }
        }

        const fallbackTimes = ['20:45:00', '22:00:00', '05:00:00'];
        for (const time of fallbackTimes) {
          if (uniqueStarts.size >= 7) {
            break;
          }
          if (!uniqueStarts.has(time)) {
            uniqueStarts.set(time, withTime(today, time));
          }
        }

        const slots = Array.from(uniqueStarts.values())
          .sort((a, b) => a.getTime() - b.getTime())
          .slice(0, 7);

        return slots.map((start, index) => {
          const endsAt = new Date(start.getTime() + tripDurationMin * 60 * 1000);
          const routeId = index % 2 === 0 ? forwardRouteId : reverseRouteId;

          return {
            id: index + 1,
            routeId,
            vehicleId: tripVehicleId,
            driverId: tripDriverId,
            startsAt: tsAt(start, formatTime(start)),
            endsAt: tsAt(endsAt, formatTime(endsAt)),
            passengerCount: 0,
          };
        });
      })();

      await tx
        .insert(trips)
        .values(tripValues)
        .onConflictDoUpdate({
          target: trips.id,
          set: {
            routeId: sql.raw('excluded.route_id'),
            vehicleId: sql.raw('excluded.vehicle_id'),
            driverId: sql.raw('excluded.driver_id'),
            startsAt: sql.raw('excluded.starts_at'),
            endsAt: sql.raw('excluded.ends_at'),
            passengerCount: sql.raw('excluded.passenger_count'),
          },
        });

      await tx
        .insert(transportCards)
        .values([
          { id: 1, userId: 1, balance: '0.00', cardNumber: 'CARD-0001' },
          { id: 2, userId: 2, balance: '0.00', cardNumber: 'CARD-0002' },
          { id: 3, userId: 3, balance: '0.00', cardNumber: 'CARD-0003' },
          { id: 4, userId: 4, balance: '0.00', cardNumber: 'CARD-0004' },
        ])
        .onConflictDoNothing();

      await tx
        .insert(fines)
        .values([
          {
            id: 1,
            userId: 2,
            status: 'В процесі',
            amount: '150.00',
            reason: 'Безквитковий проїзд',
            tripId: 1,
            issuedAt: tsAt(today, '08:30:00'),
          },
          {
            id: 2,
            userId: 3,
            status: 'Оплачено',
            amount: '120.00',
            reason: 'Невалідований квиток',
            tripId: 2,
            issuedAt: tsAt(today, '09:20:00'),
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(fineAppeals)
        .values([
          {
            id: 1,
            fineId: 1,
            message: 'Прошу скасувати штраф - купон був!',
            status: 'Подано',
            createdAt: tsAt(today, '09:00:00'),
          },
          {
            id: 2,
            fineId: 2,
            message: 'Штраф сплачено помилково, прошу повернення',
            status: 'Подано',
            createdAt: tsAt(today, '10:00:00'),
          },
        ])
        .onConflictDoNothing();

      if (!seedRandomEnabled) {
        await tx
          .insert(tickets)
          .values([
            {
              id: 1,
              tripId: 1,
              cardId: 1,
              price: '15.00',
              purchasedAt: seedTimestamp,
            },
            {
              id: 2,
              tripId: 2,
              cardId: 2,
              price: '15.00',
              purchasedAt: seedTimestamp,
            },
            {
              id: 3,
              tripId: 2,
              cardId: 3,
              price: '15.00',
              purchasedAt: seedTimestamp,
            },
            {
              id: 4,
              tripId: 3,
              cardId: 4,
              price: '20.00',
              purchasedAt: seedTimestamp,
            },
          ])
          .onConflictDoNothing();

        await tx
          .insert(userGpsLogs)
          .values([
            {
              id: 1,
              userId: 1,
              lon: '30.524',
              lat: '50.45',
              recordedAt: seedTimestamp,
            },
            {
              id: 2,
              userId: 2,
              lon: '30.52',
              lat: '50.449',
              recordedAt: seedTimestamp,
            },
          ])
          .onConflictDoNothing();

      await tx
        .insert(vehicleGpsLogs)
        .values([
          {
            id: 1,
            vehicleId: 1,
            lon: '30.528',
            lat: '50.451',
            recordedAt: seedTimestamp,
          },
          {
            id: 2,
            vehicleId: 2,
            lon: '30.535',
            lat: '50.457',
            recordedAt: seedTimestamp,
          },
          {
            id: 3,
            vehicleId: 3,
            lon: '30.542',
            lat: '50.463',
            recordedAt: seedTimestamp,
          },
          {
            id: 4,
            vehicleId: 1,
            lon: '30.532',
            lat: '50.455',
            recordedAt: tsAt(today, '07:10:00'),
          },
          {
            id: 5,
            vehicleId: 1,
            lon: '30.538',
            lat: '50.459',
            recordedAt: tsAt(today, '07:25:00'),
          },
          {
            id: 6,
            vehicleId: 1,
            lon: '30.545',
            lat: '50.463',
            recordedAt: tsAt(today, '07:40:00'),
          },
        ])
        .onConflictDoNothing();

        await tx
          .insert(cardTopUps)
          .values([
            { id: 1, cardId: 1, amount: '200.00', toppedUpAt: seedTimestamp },
            { id: 2, cardId: 2, amount: '150.00', toppedUpAt: seedTimestamp },
            { id: 3, cardId: 3, amount: '100.00', toppedUpAt: seedTimestamp },
            { id: 4, cardId: 4, amount: '50.00', toppedUpAt: seedTimestamp },
          ])
          .onConflictDoNothing();
      }

      await tx
        .insert(driverVehicleAssignments)
        .values([
          {
            id: 1,
            driverId: 1,
            vehicleId: 1,
            assignedAt: tsAt(today, '05:30:00'),
          },
          {
            id: 2,
            driverId: 2,
            vehicleId: 2,
            assignedAt: tsAt(today, '05:40:00'),
          },
          {
            id: 3,
            driverId: 3,
            vehicleId: 3,
            assignedAt: tsAt(today, '05:50:00'),
          },
        ])
        .onConflictDoUpdate({
          target: driverVehicleAssignments.id,
          set: {
            driverId: sql.raw('excluded.driver_id'),
            vehicleId: sql.raw('excluded.vehicle_id'),
            assignedAt: sql.raw('excluded.assigned_at'),
          },
        });

      await tx
        .insert(schedules)
        .values([
          {
            id: 1,
            routeId: 1,
            workStartTime: '06:00:00',
            workEndTime: '23:00:00',
            intervalMin: 10,
          },
          {
            id: 2,
            routeId: 2,
            workStartTime: '06:30:00',
            workEndTime: '22:30:00',
            intervalMin: 12,
          },
          {
            id: 3,
            routeId: 11,
            workStartTime: '06:00:00',
            workEndTime: '23:00:00',
            intervalMin: 10,
          },
        ])
        .onConflictDoNothing();

      const [{ maxTripId }] = await tx
        .select({ maxTripId: sql<number>`coalesce(max(${trips.id}), 0)` })
        .from(trips);
      await tx.execute(
        sql`select setval(pg_get_serial_sequence('trips','id'), ${maxTripId}, true)`,
      );

      if (!seedRandomEnabled) {
        await tx
          .insert(complaintsSuggestions)
          .values([
            {
              id: 1,
              userId: 1,
              type: 'Пропозиція',
              message: 'Будь ласка, додайте кондиціонер у салоні',
              tripId: 1,
              status: 'Подано',
            },
            {
              id: 2,
              userId: 4,
              type: 'Скарга',
              message: 'Довго чекала на зупинці Парк',
              tripId: 3,
              status: 'Подано',
            },
          ])
          .onConflictDoNothing();
      }

      await tx
        .insert(routePoints)
        .values([
          {
            id: 1,
            routeId: 1,
            lon: '30.5000',
            lat: '50.4000',
            prevRoutePointId: null,
            nextRoutePointId: 2,
          },
          {
            id: 2,
            routeId: 1,
            lon: '30.5600',
            lat: '50.4500',
            prevRoutePointId: 1,
            nextRoutePointId: 3,
          },
          {
            id: 3,
            routeId: 1,
            lon: '30.6200',
            lat: '50.5000',
            prevRoutePointId: 2,
            nextRoutePointId: 4,
          },
          {
            id: 4,
            routeId: 1,
            lon: '30.6800',
            lat: '50.5500',
            prevRoutePointId: 3,
            nextRoutePointId: 5,
          },
          {
            id: 5,
            routeId: 1,
            lon: '30.7400',
            lat: '50.6000',
            prevRoutePointId: 4,
            nextRoutePointId: 6,
          },
          {
            id: 6,
            routeId: 1,
            lon: '30.8000',
            lat: '50.6500',
            prevRoutePointId: 5,
            nextRoutePointId: 7,
          },
          {
            id: 7,
            routeId: 1,
            lon: '30.8600',
            lat: '50.7000',
            prevRoutePointId: 6,
            nextRoutePointId: 8,
          },
          {
            id: 8,
            routeId: 1,
            lon: '30.9200',
            lat: '50.7500',
            prevRoutePointId: 7,
            nextRoutePointId: null,
          },
          {
            id: 101,
            routeId: 11,
            lon: '30.9200',
            lat: '50.7500',
            prevRoutePointId: null,
            nextRoutePointId: 102,
          },
          {
            id: 102,
            routeId: 11,
            lon: '30.8600',
            lat: '50.7000',
            prevRoutePointId: 101,
            nextRoutePointId: 103,
          },
          {
            id: 103,
            routeId: 11,
            lon: '30.8000',
            lat: '50.6500',
            prevRoutePointId: 102,
            nextRoutePointId: 104,
          },
          {
            id: 104,
            routeId: 11,
            lon: '30.7400',
            lat: '50.6000',
            prevRoutePointId: 103,
            nextRoutePointId: 105,
          },
          {
            id: 105,
            routeId: 11,
            lon: '30.6800',
            lat: '50.5500',
            prevRoutePointId: 104,
            nextRoutePointId: 106,
          },
          {
            id: 106,
            routeId: 11,
            lon: '30.6200',
            lat: '50.5000',
            prevRoutePointId: 105,
            nextRoutePointId: 107,
          },
          {
            id: 107,
            routeId: 11,
            lon: '30.5600',
            lat: '50.4500',
            prevRoutePointId: 106,
            nextRoutePointId: 108,
          },
          {
            id: 108,
            routeId: 11,
            lon: '30.5000',
            lat: '50.4000',
            prevRoutePointId: 107,
            nextRoutePointId: null,
          },
          {
            id: 109,
            routeId: 2,
            lon: '30.5234567',
            lat: '50.4501234',
            prevRoutePointId: null,
            nextRoutePointId: 110,
          },
          {
            id: 110,
            routeId: 2,
            lon: '30.53',
            lat: '50.4515',
            prevRoutePointId: 109,
            nextRoutePointId: 111,
          },
          {
            id: 111,
            routeId: 2,
            lon: '30.5012345',
            lat: '50.4478123',
            prevRoutePointId: 110,
            nextRoutePointId: null,
          },
        ])
        .onConflictDoNothing();
    });

    const counts = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(userGpsLogs),
      db.select({ count: sql<number>`count(*)` }).from(vehicleGpsLogs),
      db.select({ count: sql<number>`count(*)` }).from(cardTopUps),
      db.select({ count: sql<number>`count(*)` }).from(tickets),
      db.select({ count: sql<number>`count(*)` }).from(complaintsSuggestions),
    ]);

    const [
      [{ count: userGpsCount }],
      [{ count: vehicleGpsCount }],
      [{ count: cardTopUpCount }],
      [{ count: ticketsCount }],
      [{ count: complaintsCount }],
    ] = counts;

    const isRandomSeedNeeded =
      Number(userGpsCount) === 0 &&
      Number(vehicleGpsCount) === 0 &&
      Number(cardTopUpCount) === 0 &&
      Number(ticketsCount) === 0 &&
      Number(complaintsCount) === 0;

    if (seedRandomEnabled && isRandomSeedNeeded) {
      const userIds = [1, 2, 3, 4];
      const cardIds = [1, 2, 3, 4];
      const tripIds = [1, 2, 3, 4, 5, 6, 7];
      const vehicleIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
      const lonValues = [
        '30.5234567',
        '30.5012345',
        '30.5154321',
        '30.53',
        '30.535',
        '30.5401',
        '30.5255',
        '30.5488',
        '30.5099',
        '30.5322',
        '30.602',
      ];
      const latValues = [
        '50.4501234',
        '50.4478123',
        '50.4487654',
        '50.4515',
        '50.4522',
        '50.4533',
        '50.4499',
        '50.4555',
        '50.4464',
        '50.4601',
        '50.412',
      ];
      const dateRange = {
        minDate: formatDate(
          new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
        ),
        maxDate: formatDate(
          new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000),
        ),
      };

      await drizzleSeed(
        db,
        {
          userGpsLogs,
          vehicleGpsLogs,
          cardTopUps,
          tickets,
          complaintsSuggestions,
        },
        {
          seed: 20250102,
        },
      ).refine((f) => ({
        userGpsLogs: {
          count: 12,
          columns: {
            userId: f.valuesFromArray({ values: userIds }),
            lon: f.valuesFromArray({ values: lonValues }),
            lat: f.valuesFromArray({ values: latValues }),
            recordedAt: f.date(dateRange),
          },
        },
        vehicleGpsLogs: {
          count: 12,
          columns: {
            vehicleId: f.valuesFromArray({ values: vehicleIds }),
            lon: f.valuesFromArray({ values: lonValues }),
            lat: f.valuesFromArray({ values: latValues }),
            recordedAt: f.date(dateRange),
          },
        },
        cardTopUps: {
          count: 8,
          columns: {
            cardId: f.valuesFromArray({ values: cardIds }),
            amount: f.valuesFromArray({
              values: ['20.00', '50.00', '100.00', '150.00'],
            }),
            toppedUpAt: f.date(dateRange),
          },
        },
        tickets: {
          count: 12,
          columns: {
            tripId: f.valuesFromArray({ values: tripIds }),
            cardId: f.valuesFromArray({ values: cardIds }),
            price: f.valuesFromArray({
              values: ['15.00', '20.00', '25.00'],
            }),
            purchasedAt: f.date(dateRange),
          },
        },
        complaintsSuggestions: {
          count: 6,
          columns: {
            userId: f.valuesFromArray({ values: userIds }),
            type: f.valuesFromArray({ values: ['Скарга', 'Пропозиція'] }),
            message: f.loremIpsum(),
            status: f.valuesFromArray({
              values: ['Подано', 'Розглядається', 'Розглянуто'],
            }),
            tripId: f.valuesFromArray({ values: tripIds }),
            createdAt: f.date(dateRange),
          },
        },
      }));
    }

    await db.execute(sql.raw(`${SETVAL_STATEMENTS.join(';\n')};`));
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  seedDatabase().catch((error) => {
    console.error('Failed to seed database', error);
    process.exit(1);
  });
}
