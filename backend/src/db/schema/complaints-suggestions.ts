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
import { trips } from './trips';
import { users } from './users';
import { routes } from './routes';
import { vehicles } from './vehicles';

export const complaintsSuggestions = pgTable(
  'complaints_suggestions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' }).references(() => users.id),
    type: text('type').notNull(),
    message: text('message').notNull(),
    tripId: bigint('trip_id', { mode: 'number' }).references(() => trips.id),
    routeId: integer('route_id').references(() => routes.id),
    vehicleId: bigint('vehicle_id', { mode: 'number' }).references(
      () => vehicles.id,
    ),
    contactInfo: text('contact_info'),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  () => ({
    complaintsSuggestionsStatusCheck: check(
      'complaints_suggestions_status_check',
      sql.raw(`"status" in ('Подано', 'Розглядається', 'Розглянуто')`),
    ),
  }),
);
