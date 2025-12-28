import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  integer,
  pgTable,
  time,
} from 'drizzle-orm/pg-core';
import { routes } from './routes';

export const schedules = pgTable(
  'schedules',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    routeId: bigint('route_id', { mode: 'number' })
      .notNull()
      .unique()
      .references(() => routes.id),
    workStartTime: time('work_start_time').notNull(),
    workEndTime: time('work_end_time').notNull(),
    intervalMin: integer('interval_min').notNull(),
  },
  () => ({
    schedulesIntervalCheck: check(
      'schedules_interval_check',
      sql.raw('"interval_min" > 0'),
    ),
  }),
);
