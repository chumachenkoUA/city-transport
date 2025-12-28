import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  integer,
  pgTable,
  text,
} from 'drizzle-orm/pg-core';
import { routes } from './routes';
import { transportTypes } from './transport-types';

export const vehicles = pgTable(
  'vehicles',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    fleetNumber: text('fleet_number').notNull().unique(),
    transportTypeId: bigint('transport_type_id', { mode: 'number' })
      .notNull()
      .references(() => transportTypes.id),
    capacity: integer('capacity').notNull(),
    routeId: bigint('route_id', { mode: 'number' })
      .notNull()
      .references(() => routes.id),
  },
  () => ({
    vehiclesCapacityCheck: check(
      'vehicles_capacity_check',
      sql.raw('"capacity" > 0'),
    ),
  }),
);
