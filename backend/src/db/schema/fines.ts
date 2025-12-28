import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { trips } from './trips';
import { users } from './users';

export const fines = pgTable(
  'fines',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .references(() => users.id),
    status: text('status').notNull(),
    tripId: bigint('trip_id', { mode: 'number' })
      .notNull()
      .references(() => trips.id),
    issuedAt: timestamp('issued_at').notNull().defaultNow(),
  },
  () => ({
    finesStatusCheck: check(
      'fines_status_check',
      sql.raw(
        `"status" in ('В процесі', 'Оплачено', 'Відмінено', 'Прострочено')`,
      ),
    ),
  }),
);
