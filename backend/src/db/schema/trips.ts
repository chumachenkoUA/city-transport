import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  integer,
  pgTable,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { drivers } from './drivers';
import { routes } from './routes';
import { vehicles } from './vehicles';

export const trips = pgTable(
  'trips',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    routeId: bigint('route_id', { mode: 'number' })
      .notNull()
      .references(() => routes.id),
    vehicleId: bigint('vehicle_id', { mode: 'number' })
      .notNull()
      .references(() => vehicles.id),
    driverId: bigint('driver_id', { mode: 'number' })
      .notNull()
      .references(() => drivers.id),
    startsAt: timestamp('starts_at').notNull(),
    endsAt: timestamp('ends_at').notNull(),
    passengerCount: integer('passenger_count').notNull().default(0),
  },
  (table) => ({
    tripsVehicleTimeUnique: unique('trips_vehicle_time_unique').on(
      table.vehicleId,
      table.startsAt,
      table.endsAt,
    ),
    tripsEndsAfterStartsCheck: check(
      'trips_ends_after_starts_check',
      sql.raw('"ends_at" > "starts_at"'),
    ),
    tripsPassengerCountCheck: check(
      'trips_passenger_count_check',
      sql.raw('"passenger_count" >= 0'),
    ),
  }),
);
