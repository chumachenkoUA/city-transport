import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  integer,
  pgTable,
  time,
  unique,
} from 'drizzle-orm/pg-core';
import { routes } from './routes';
import { vehicles } from './vehicles';

export const schedules = pgTable(
  'schedules',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    routeId: bigint('route_id', { mode: 'number' })
      .notNull()
      .references(() => routes.id),
    vehicleId: bigint('vehicle_id', { mode: 'number' }).references(
      () => vehicles.id,
    ),
    workStartTime: time('work_start_time').notNull(),
    workEndTime: time('work_end_time').notNull(),
    intervalMin: integer('interval_min').notNull(),

    // Days of week
    monday: boolean('monday').default(false).notNull(),
    tuesday: boolean('tuesday').default(false).notNull(),
    wednesday: boolean('wednesday').default(false).notNull(),
    thursday: boolean('thursday').default(false).notNull(),
    friday: boolean('friday').default(false).notNull(),
    saturday: boolean('saturday').default(false).notNull(),
    sunday: boolean('sunday').default(false).notNull(),

    // Period of validity
    validFrom: date('valid_from'),
    validTo: date('valid_to'),
  },
  (table) => ({
    schedulesIntervalCheck: check(
      'schedules_interval_check',
      sql.raw('"interval_min" > 0'),
    ),
    schedulesTimeCheck: check(
      'schedules_time_check',
      sql.raw('"work_end_time" > "work_start_time"'),
    ),
    schedulesRouteVehiclePeriodUnique: unique(
      'schedules_route_vehicle_period_unique',
    ).on(table.routeId, table.vehicleId, table.validFrom),
  }),
);
