import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  pgTable,
  timestamp,
  varchar,
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
    type: varchar('type', { length: 50 }).notNull(),
    message: varchar('message', { length: 2000 }).notNull(),
    tripId: bigint('trip_id', { mode: 'number' }).references(() => trips.id),
    routeId: bigint('route_id', { mode: 'number' }).references(() => routes.id),
    vehicleId: bigint('vehicle_id', { mode: 'number' }).references(
      () => vehicles.id,
    ),
    contactInfo: varchar('contact_info', { length: 200 }),
    status: varchar('status', { length: 50 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  () => ({
    complaintsSuggestionsStatusCheck: check(
      'complaints_suggestions_status_check',
      sql.raw(`"status" in ('Подано', 'Розглядається', 'Розглянуто')`),
    ),
  }),
);
