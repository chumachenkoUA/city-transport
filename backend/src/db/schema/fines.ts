import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  numeric,
  pgTable,
  timestamp,
  varchar,
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
    status: varchar('status', { length: 50 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    reason: varchar('reason', { length: 500 }).notNull(),
    issuedBy: varchar('issued_by', { length: 50 })
      .notNull()
      .default(sql.raw('current_user')),
    tripId: bigint('trip_id', { mode: 'number' })
      .notNull()
      .references(() => trips.id),
    issuedAt: timestamp('issued_at').notNull().defaultNow(),
  },
  () => ({
    finesAmountCheck: check('fines_amount_check', sql.raw('"amount" > 0')),
    finesStatusCheck: check(
      'fines_status_check',
      sql.raw(
        `"status" in ('Очікує сплати', 'В процесі', 'Оплачено', 'Відмінено', 'Прострочено')`,
      ),
    ),
  }),
);
