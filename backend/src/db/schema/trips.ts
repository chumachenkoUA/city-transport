import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  integer,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { drivers } from './drivers';
import { routes } from './routes';

export const trips = pgTable(
  'trips',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    routeId: bigint('route_id', { mode: 'number' })
      .notNull()
      .references(() => routes.id),
    driverId: bigint('driver_id', { mode: 'number' })
      .notNull()
      .references(() => drivers.id),

    // Планові часи (диспетчер створює)
    plannedStartsAt: timestamp('planned_starts_at').notNull(),
    plannedEndsAt: timestamp('planned_ends_at'),

    // Фактичні часи (водій заповнює)
    actualStartsAt: timestamp('actual_starts_at'),
    actualEndsAt: timestamp('actual_ends_at'),

    // Статус рейсу
    status: text('status').notNull().default('scheduled'),

    passengerCount: integer('passenger_count').notNull().default(0),
  },
  (table) => ({
    tripsStatusCheck: check(
      'trips_status_check',
      sql.raw(
        `"status" in ('scheduled', 'in_progress', 'completed', 'cancelled')`,
      ),
    ),
    tripsActualEndsAfterStartsCheck: check(
      'trips_actual_ends_after_starts_check',
      sql.raw(
        '"actual_ends_at" is null or "actual_starts_at" is null or "actual_ends_at" > "actual_starts_at"',
      ),
    ),
    tripsPassengerCountCheck: check(
      'trips_passenger_count_check',
      sql.raw('"passenger_count" >= 0'),
    ),
  }),
);
