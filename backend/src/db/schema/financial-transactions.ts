import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  date,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { budgets } from './budgets';
import { drivers } from './drivers';
import { fines } from './fines';
import { routes } from './routes';
import { salaryPayments } from './salary-payments';
import { tickets } from './tickets';
import { transportCards } from './transport-cards';
import { trips } from './trips';

export const financialTransactions = pgTable(
  'financial_transactions',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    txType: text('tx_type').notNull(),
    source: text('source').notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    occurredAt: timestamp('occurred_at').notNull().defaultNow(),
    description: text('description'),
    createdBy: text('created_by').notNull().default(sql`current_user`),

    // Прямі FK посилання на джерело операції (UNIQUE = one-to-one)
    ticketId: bigint('ticket_id', { mode: 'number' })
      .unique()
      .references(() => tickets.id, { onDelete: 'set null' }),
    fineId: bigint('fine_id', { mode: 'number' })
      .unique()
      .references(() => fines.id, { onDelete: 'set null' }),
    salaryPaymentId: bigint('salary_payment_id', { mode: 'number' })
      .unique()
      .references(() => salaryPayments.id, { onDelete: 'set null' }),

    // Контекстні FK для аналітики
    tripId: bigint('trip_id', { mode: 'number' }).references(() => trips.id, {
      onDelete: 'set null',
    }),
    routeId: bigint('route_id', { mode: 'number' }).references(
      () => routes.id,
      { onDelete: 'set null' },
    ),
    driverId: bigint('driver_id', { mode: 'number' }).references(
      () => drivers.id,
      { onDelete: 'set null' },
    ),
    cardId: bigint('card_id', { mode: 'number' }).references(
      () => transportCards.id,
      { onDelete: 'set null' },
    ),

    // FK до бюджету (auto-populated by trigger)
    budgetMonth: date('budget_month').references(() => budgets.month, {
      onDelete: 'set null',
    }),
  },
  () => ({
    txTypeCheck: check(
      'financial_transactions_tx_type_check',
      sql.raw(`"tx_type" in ('income', 'expense')`),
    ),
    sourceCheck: check(
      'financial_transactions_source_check',
      sql.raw(
        `"source" in ('ticket', 'fine', 'government', 'other', 'salary', 'fuel', 'maintenance', 'other_expense')`,
      ),
    ),
    amountCheck: check(
      'financial_transactions_amount_check',
      sql.raw('"amount" > 0'),
    ),
  }),
);
