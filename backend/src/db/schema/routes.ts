import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  boolean,
  check,
  pgTable,
  text,
  unique,
} from 'drizzle-orm/pg-core';
import { transportTypes } from './transport-types';

export const routes = pgTable(
  'routes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    transportTypeId: bigint('transport_type_id', { mode: 'number' })
      .notNull()
      .references(() => transportTypes.id),
    number: text('number').notNull(),
    direction: text('direction').notNull(),
    isActive: boolean('is_active').notNull().default(true),
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
