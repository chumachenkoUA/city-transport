import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  date,
  numeric,
  pgTable,
  text,
  unique,
} from 'drizzle-orm/pg-core';

export const budgets = pgTable(
  'budgets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    month: date('month').notNull(),
    income: numeric('income', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    expenses: numeric('expenses', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    note: text('note'),
  },
  (table) => ({
    budgetsMonthUnique: unique('budgets_month_unique').on(table.month),
    budgetsIncomeCheck: check('budgets_income_check', sql.raw('"income" >= 0')),
    budgetsExpensesCheck: check(
      'budgets_expenses_check',
      sql.raw('"expenses" >= 0'),
    ),
  }),
);
