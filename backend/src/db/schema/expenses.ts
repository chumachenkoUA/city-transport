import { sql } from 'drizzle-orm';
import { bigserial, check, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const expenses = pgTable(
  'expenses',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    category: text('category').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    description: text('description'),
    occurredAt: timestamp('occurred_at').notNull().defaultNow(),
    documentRef: text('document_ref'),
  },
  () => ({
    expensesAmountCheck: check('expenses_amount_check', sql.raw('"amount" > 0')),
  }),
);
