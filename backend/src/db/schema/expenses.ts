import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  numeric,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const expenses = pgTable(
  'expenses',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    category: varchar('category', { length: 100 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    description: varchar('description', { length: 500 }),
    occurredAt: timestamp('occurred_at').notNull().defaultNow(),
    documentRef: varchar('document_ref', { length: 100 }),
  },
  () => ({
    expensesAmountCheck: check(
      'expenses_amount_check',
      sql.raw('"amount" > 0'),
    ),
  }),
);
