import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  pgTable,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';
import { transportTypes } from './transport-types';

export const routes = pgTable(
  'routes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    transportTypeId: bigint('transport_type_id', { mode: 'number' })
      .notNull()
      .references(() => transportTypes.id),
    number: varchar('number', { length: 10 }).notNull(),
    direction: varchar('direction', { length: 10 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
    // Self-reference to pair forward ↔ reverse routes
    // Allows vehicle assigned to one direction to be used for the paired direction
    pairedRouteId: bigint('paired_route_id', { mode: 'number' }),
  },
  (table) => ({
    routesTransportTypeNumberDirectionUnique: unique(
      'routes_transport_type_number_direction_unique',
    ).on(table.transportTypeId, table.number, table.direction),
    routesDirectionCheck: check(
      'routes_direction_check',
      sql.raw(`"direction" in ('forward', 'reverse')`),
    ),
  }),
);
