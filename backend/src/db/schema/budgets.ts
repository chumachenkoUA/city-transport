import { sql } from 'drizzle-orm';
import {
  bigserial,
  check,
  date,
  numeric,
  pgTable,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';

export const budgets = pgTable(
  'budgets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    month: date('month').notNull(),
    plannedIncome: numeric('planned_income', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    plannedExpenses: numeric('planned_expenses', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    actualIncome: numeric('actual_income', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    actualExpenses: numeric('actual_expenses', { precision: 14, scale: 2 })
      .notNull()
      .default('0'),
    note: varchar('note', { length: 500 }),
  },
  (table) => ({
    budgetsMonthUnique: unique('budgets_month_unique').on(table.month),
    budgetsPlannedIncomeCheck: check(
      'budgets_planned_income_check',
      sql.raw('"planned_income" >= 0'),
    ),
    budgetsPlannedExpensesCheck: check(
      'budgets_planned_expenses_check',
      sql.raw('"planned_expenses" >= 0'),
    ),
    budgetsActualIncomeCheck: check(
      'budgets_actual_income_check',
      sql.raw('"actual_income" >= 0'),
    ),
    budgetsActualExpensesCheck: check(
      'budgets_actual_expenses_check',
      sql.raw('"actual_expenses" >= 0'),
    ),
  }),
);
