import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  numeric,
  pgTable,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const incomes = pgTable(
  'incomes',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    source: varchar('source', { length: 50 }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    description: varchar('description', { length: 500 }),
    documentRef: varchar('document_ref', { length: 100 }),
    receivedAt: timestamp('received_at').notNull().defaultNow(),
  },
  () => ({
    incomesAmountCheck: check('incomes_amount_check', sql.raw('"amount" > 0')),
    incomesSourceCheck: check(
      'incomes_source_check',
      sql.raw(`"source" in ('government', 'tickets', 'fines', 'other')`),
    ),
  }),
);
