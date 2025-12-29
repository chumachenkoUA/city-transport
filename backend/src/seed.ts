import 'dotenv/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
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

async function main() {
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

    const ts = (value: string) => sql.raw(`timestamp '${value}'`);
    const seedTimestamp = ts('2025-11-10 14:47:49.873331');

    await db.transaction(async (tx) => {
      await tx
        .insert(drivers)
        .values([
          {
            id: 1,
            email: 'driver1@example.com',
            phone: '+380971112233',
            fullName: 'Сидоренко Петро Іванович',
            driverLicenseNumber: 'KP123456',
            passportData: { number: '123456', series: 'AB' },
          },
          {
            id: 2,
            email: 'driver2@example.com',
            phone: '+380972223344',
            fullName: 'Коваль Андрій Петрович',
            driverLicenseNumber: 'KP654321',
            passportData: { number: '654321', series: 'AB' },
          },
          {
            id: 3,
            email: 'driver3@example.com',
            phone: '+380973334455',
            fullName: 'Мельник Ігор Васильович',
            driverLicenseNumber: 'KP777888',
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
            lon: '30.5234567',
            lat: '50.4501234',
          },
          { id: 2, name: 'Вокзал', lon: '30.5012345', lat: '50.4478123' },
          { id: 3, name: 'Магазин', lon: '30.5154321', lat: '50.4487654' },
          { id: 4, name: 'Університет', lon: '30.53', lat: '50.4515' },
          { id: 5, name: 'Парк', lon: '30.535', lat: '50.4522' },
          { id: 7, name: 'Депо', lon: '30.5401', lat: '50.4533' },
          { id: 8, name: 'Музей', lon: '30.5255', lat: '50.4499' },
          { id: 9, name: 'Технопарк', lon: '30.5488', lat: '50.4555' },
          { id: 10, name: 'Ринок', lon: '30.5099', lat: '50.4464' },
          { id: 11, name: 'Стадіон', lon: '30.5322', lat: '50.4601' },
          { id: 12, name: 'Аеропорт', lon: '30.602', lat: '50.412' },
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
            nextRouteStopId: 4,
            distanceToNextKm: '0.488',
          },
          {
            id: 4,
            routeId: 1,
            stopId: 4,
            prevRouteStopId: 1,
            nextRouteStopId: 5,
            distanceToNextKm: '0.362',
          },
          {
            id: 5,
            routeId: 1,
            stopId: 5,
            prevRouteStopId: 4,
            nextRouteStopId: null,
            distanceToNextKm: null,
          },
          {
            id: 6,
            routeId: 2,
            stopId: 1,
            prevRouteStopId: null,
            nextRouteStopId: 7,
            distanceToNextKm: '0.488',
          },
          {
            id: 7,
            routeId: 2,
            stopId: 4,
            prevRouteStopId: 6,
            nextRouteStopId: 8,
            distanceToNextKm: '2.078',
          },
          {
            id: 8,
            routeId: 2,
            stopId: 2,
            prevRouteStopId: 7,
            nextRouteStopId: 11,
            distanceToNextKm: '0.633',
          },
          {
            id: 11,
            routeId: 2,
            stopId: 10,
            prevRouteStopId: 8,
            nextRouteStopId: null,
            distanceToNextKm: null,
          },
          {
            id: 12,
            routeId: 6,
            stopId: 1,
            prevRouteStopId: null,
            nextRouteStopId: 13,
            distanceToNextKm: '1.594',
          },
          {
            id: 13,
            routeId: 6,
            stopId: 2,
            prevRouteStopId: 12,
            nextRouteStopId: 14,
            distanceToNextKm: '0.633',
          },
          {
            id: 14,
            routeId: 6,
            stopId: 10,
            prevRouteStopId: 13,
            nextRouteStopId: 15,
            distanceToNextKm: '2.272',
          },
          {
            id: 15,
            routeId: 6,
            stopId: 7,
            prevRouteStopId: 14,
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
            id: 16,
            routeId: 10,
            stopId: 3,
            prevRouteStopId: null,
            nextRouteStopId: 17,
            distanceToNextKm: '1.731',
          },
          {
            id: 17,
            routeId: 10,
            stopId: 11,
            prevRouteStopId: 16,
            nextRouteStopId: 18,
            distanceToNextKm: '7.283',
          },
          {
            id: 18,
            routeId: 10,
            stopId: 12,
            prevRouteStopId: 17,
            nextRouteStopId: 19,
            distanceToNextKm: '8.173',
          },
          {
            id: 19,
            routeId: 10,
            stopId: 2,
            prevRouteStopId: 18,
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
            email: 'pupkin@example.com',
            phone: '+380991112233',
            fullName: 'Пупкін Василь Олександрович',
            registeredAt: seedTimestamp,
          },
          {
            id: 2,
            email: 'ivanova@example.com',
            phone: '+380992223344',
            fullName: 'Іванова Марія Сергіївна',
            registeredAt: seedTimestamp,
          },
          {
            id: 3,
            email: 'bondar@example.com',
            phone: '+380993334455',
            fullName: 'Бондар Олег Ігорович',
            registeredAt: seedTimestamp,
          },
          {
            id: 4,
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

      await tx
        .insert(trips)
        .values([
          {
            id: 1,
            routeId: 1,
            vehicleId: 1,
            driverId: 1,
            startsAt: ts('2025-06-09 08:00:00'),
            endsAt: ts('2025-06-09 08:40:00'),
            passengerCount: 0,
          },
          {
            id: 2,
            routeId: 1,
            vehicleId: 2,
            driverId: 2,
            startsAt: ts('2025-06-09 09:00:00'),
            endsAt: ts('2025-06-09 09:40:00'),
            passengerCount: 0,
          },
          {
            id: 3,
            routeId: 2,
            vehicleId: 3,
            driverId: 3,
            startsAt: ts('2025-06-09 10:00:00'),
            endsAt: ts('2025-06-09 10:30:00'),
            passengerCount: 0,
          },
          {
            id: 14,
            routeId: 2,
            vehicleId: 1,
            driverId: 1,
            startsAt: ts('2025-06-09 11:00:00'),
            endsAt: ts('2025-06-09 11:30:00'),
            passengerCount: 0,
          },
        ])
        .onConflictDoNothing();

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
            issuedAt: ts('2025-06-09 08:30:00'),
          },
          {
            id: 2,
            userId: 3,
            status: 'Оплачено',
            amount: '120.00',
            reason: 'Невалідований квиток',
            tripId: 2,
            issuedAt: ts('2025-06-09 09:20:00'),
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
            createdAt: ts('2025-06-09 09:00:00'),
          },
          {
            id: 2,
            fineId: 2,
            message: 'Штраф сплачено помилково, прошу повернення',
            status: 'Подано',
            createdAt: ts('2025-06-09 10:00:00'),
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

      await tx
        .insert(driverVehicleAssignments)
        .values([
          {
            id: 1,
            driverId: 1,
            vehicleId: 1,
            assignedAt: ts('2025-06-09 07:30:00'),
          },
          {
            id: 2,
            driverId: 2,
            vehicleId: 2,
            assignedAt: ts('2025-06-09 07:40:00'),
          },
          {
            id: 3,
            driverId: 3,
            vehicleId: 3,
            assignedAt: ts('2025-06-09 08:30:00'),
          },
        ])
        .onConflictDoNothing();

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
        ])
        .onConflictDoNothing();

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

      await tx
        .insert(routePoints)
        .values([
          {
            id: 1,
            routeId: 1,
            lon: '30.5234567',
            lat: '50.4501234',
            prevRoutePointId: null,
            nextRoutePointId: 2,
          },
          {
            id: 2,
            routeId: 1,
            lon: '30.522',
            lat: '50.4498',
            prevRoutePointId: 1,
            nextRoutePointId: 3,
          },
          {
            id: 3,
            routeId: 1,
            lon: '30.52',
            lat: '50.449',
            prevRoutePointId: 2,
            nextRoutePointId: 4,
          },
          {
            id: 4,
            routeId: 1,
            lon: '30.518',
            lat: '50.4483',
            prevRoutePointId: 3,
            nextRoutePointId: 5,
          },
          {
            id: 5,
            routeId: 1,
            lon: '30.5165',
            lat: '50.448',
            prevRoutePointId: 4,
            nextRoutePointId: 6,
          },
          {
            id: 6,
            routeId: 1,
            lon: '30.515',
            lat: '50.4477',
            prevRoutePointId: 5,
            nextRoutePointId: null,
          },
          {
            id: 7,
            routeId: 2,
            lon: '30.5234567',
            lat: '50.4501234',
            prevRoutePointId: null,
            nextRoutePointId: 8,
          },
          {
            id: 8,
            routeId: 2,
            lon: '30.53',
            lat: '50.4515',
            prevRoutePointId: 7,
            nextRoutePointId: 9,
          },
          {
            id: 9,
            routeId: 2,
            lon: '30.5012345',
            lat: '50.4478123',
            prevRoutePointId: 8,
            nextRoutePointId: null,
          },
        ])
        .onConflictDoNothing();
    });

    await db.execute(sql.raw(`${SETVAL_STATEMENTS.join(';\n')};`));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Failed to seed database', error);
  process.exit(1);
});
