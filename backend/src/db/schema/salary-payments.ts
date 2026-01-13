import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  integer,
  numeric,
  pgTable,
  timestamp,
} from 'drizzle-orm/pg-core';
import { drivers } from './drivers';

export const salaryPayments = pgTable(
  'salary_payments',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    driverId: bigint('driver_id', { mode: 'number' })
      .notNull()
      .references(() => drivers.id),
    rate: numeric('rate', { precision: 12, scale: 2 }),
    units: integer('units'),
    total: numeric('total', { precision: 12, scale: 2 }).notNull(),
    paidAt: timestamp('paid_at').notNull().defaultNow(),
  },
  () => ({
    salaryPaymentsTotalCheck: check(
      'salary_payments_total_check',
      sql.raw('"total" > 0'),
    ),
    salaryPaymentsRateCheck: check(
      'salary_payments_rate_check',
      sql.raw('"rate" is null or "rate" > 0'),
    ),
    salaryPaymentsUnitsCheck: check(
      'salary_payments_units_check',
      sql.raw('"units" is null or "units" > 0'),
    ),
  }),
);
