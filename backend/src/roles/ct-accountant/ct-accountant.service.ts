import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { CreateBudgetDto } from '../../modules/budgets/dto/create-budget.dto';
import { CreateSalaryPaymentDto } from '../../modules/salary-payments/dto/create-salary-payment.dto';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateIncomeDto } from './dto/create-income.dto';
import { ExpensesQueryDto } from './dto/expenses-query.dto';
import { IncomesQueryDto } from './dto/incomes-query.dto';
import { PeriodDto } from './dto/period.dto';
import { SalariesQueryDto } from './dto/salaries-query.dto';

type FinancialReportRow = {
  category: string;
  amount: number;
  type: string;
};

@Injectable()
export class CtAccountantService {
  constructor(private readonly dbService: DbService) {}

  async upsertBudget(payload: CreateBudgetDto) {
    const result = (await this.dbService.db.execute(sql`
      select accountant_api.upsert_budget(
        ${payload.month}::date,
        ${payload.plannedIncome}::numeric,
        ${payload.plannedExpenses}::numeric,
        ${payload.note ?? null}
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0].id };
  }

  async listBudgets(query: BudgetQueryDto) {
    const result = (await this.dbService.db.execute(sql`
      select id, month, planned_income, planned_expenses, actual_income, actual_expenses, note
      from accountant_api.v_budgets
      limit ${query.limit ?? 50}
    `)) as unknown as { rows: Record<string, unknown>[] };
    return result.rows;
  }

  async createIncome(payload: CreateIncomeDto) {
    const receivedAt = payload.receivedAt ?? new Date();
    const result = (await this.dbService.db.execute(sql`
      select accountant_api.add_income(
        ${payload.source},
        ${payload.amount}::numeric,
        ${payload.description ?? null},
        ${receivedAt}::timestamp
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0].id };
  }

  async getIncomes(query: IncomesQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    let result;
    if (query.from && query.to) {
      result = (await this.dbService.db.execute(sql`
        select * from accountant_api.v_incomes
        where received_at >= ${query.from}::date
          and received_at < (${query.to}::date + interval '1 day')
        order by received_at desc
        limit ${limit} offset ${offset}
      `)) as unknown as { rows: Record<string, unknown>[] };
    } else if (query.from) {
      result = (await this.dbService.db.execute(sql`
        select * from accountant_api.v_incomes
        where received_at >= ${query.from}::date
        order by received_at desc
        limit ${limit} offset ${offset}
      `)) as unknown as { rows: Record<string, unknown>[] };
    } else if (query.to) {
      result = (await this.dbService.db.execute(sql`
        select * from accountant_api.v_incomes
        where received_at < (${query.to}::date + interval '1 day')
        order by received_at desc
        limit ${limit} offset ${offset}
      `)) as unknown as { rows: Record<string, unknown>[] };
    } else {
      result = (await this.dbService.db.execute(sql`
        select * from accountant_api.v_incomes
        order by received_at desc
        limit ${limit} offset ${offset}
      `)) as unknown as { rows: Record<string, unknown>[] };
    }
    return result.rows;
  }

  async createExpense(payload: CreateExpenseDto) {
    const occurredAt = payload.occurredAt ?? new Date();
    const result = (await this.dbService.db.execute(sql`
      select accountant_api.add_expense(
        ${payload.category},
        ${payload.amount}::numeric,
        ${payload.description ?? null},
        ${occurredAt}::timestamp
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0].id };
  }

  async getExpenses(query: ExpensesQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    // Build dynamic query with optional filters
    let result;
    if (query.from && query.to) {
      result = (await this.dbService.db.execute(sql`
        select * from accountant_api.v_expenses
        where occurred_at >= ${query.from}::date
          and occurred_at < (${query.to}::date + interval '1 day')
        order by occurred_at desc
        limit ${limit} offset ${offset}
      `)) as unknown as { rows: Record<string, unknown>[] };
    } else if (query.from) {
      result = (await this.dbService.db.execute(sql`
        select * from accountant_api.v_expenses
        where occurred_at >= ${query.from}::date
        order by occurred_at desc
        limit ${limit} offset ${offset}
      `)) as unknown as { rows: Record<string, unknown>[] };
    } else if (query.to) {
      result = (await this.dbService.db.execute(sql`
        select * from accountant_api.v_expenses
        where occurred_at < (${query.to}::date + interval '1 day')
        order by occurred_at desc
        limit ${limit} offset ${offset}
      `)) as unknown as { rows: Record<string, unknown>[] };
    } else {
      result = (await this.dbService.db.execute(sql`
        select * from accountant_api.v_expenses
        order by occurred_at desc
        limit ${limit} offset ${offset}
      `)) as unknown as { rows: Record<string, unknown>[] };
    }
    return result.rows;
  }

  async createSalary(payload: CreateSalaryPaymentDto) {
    const result = (await this.dbService.db.execute(sql`
      select accountant_api.pay_salary(
        ${payload.driverId}::bigint,
        ${payload.rate ?? null}::numeric,
        ${payload.units ?? null}::integer,
        ${payload.total ?? null}::numeric
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0].id };
  }

  async getSalaries(query: SalariesQueryDto) {
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    let result;
    if (query.from && query.to) {
      result = (await this.dbService.db.execute(sql`
        select id, paid_at, driver_id, driver_name, license_number, rate, units, total
        from accountant_api.v_salary_history
        where paid_at >= ${query.from}::date
          and paid_at < (${query.to}::date + interval '1 day')
        order by paid_at desc
        limit ${limit} offset ${offset}
      `)) as unknown as { rows: Record<string, unknown>[] };
    } else if (query.from) {
      result = (await this.dbService.db.execute(sql`
        select id, paid_at, driver_id, driver_name, license_number, rate, units, total
        from accountant_api.v_salary_history
        where paid_at >= ${query.from}::date
        order by paid_at desc
        limit ${limit} offset ${offset}
      `)) as unknown as { rows: Record<string, unknown>[] };
    } else if (query.to) {
      result = (await this.dbService.db.execute(sql`
        select id, paid_at, driver_id, driver_name, license_number, rate, units, total
        from accountant_api.v_salary_history
        where paid_at < (${query.to}::date + interval '1 day')
        order by paid_at desc
        limit ${limit} offset ${offset}
      `)) as unknown as { rows: Record<string, unknown>[] };
    } else {
      result = (await this.dbService.db.execute(sql`
        select id, paid_at, driver_id, driver_name, license_number, rate, units, total
        from accountant_api.v_salary_history
        order by paid_at desc
        limit ${limit} offset ${offset}
      `)) as unknown as { rows: Record<string, unknown>[] };
    }
    return result.rows;
  }

  async getDrivers() {
    const result = (await this.dbService.db.execute(sql`
      select id, full_name, driver_license_number
      from accountant_api.v_drivers_list
      order by full_name
    `)) as unknown as {
      rows: Array<{
        id: number;
        full_name: string;
        driver_license_number: string;
      }>;
    };
    return result.rows;
  }

  async getIncomeSummary(query: PeriodDto) {
    const report = await this.getReport(query);
    const income = report.items.filter(
      (i) => i.type === 'income' || i.type === 'income_flow',
    );
    return { income };
  }

  async getReport(query: PeriodDto) {
    let startDate = query.startDate;
    let endDate = query.endDate;

    if (!startDate || !endDate) {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        .toISOString()
        .split('T')[0];
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        .toISOString()
        .split('T')[0];
    }

    const result = (await this.dbService.db.execute(sql`
      select category, amount, type
      from accountant_api.get_financial_report(
        ${startDate}::date,
        ${endDate}::date
      )
    `)) as unknown as { rows: FinancialReportRow[] };

    const items = result.rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));

    const totalIncome = items
      .filter((i) => i.type === 'income')
      .reduce((sum, i) => sum + i.amount, 0);

    const totalExpenses = items
      .filter((i) => i.type === 'expense')
      .reduce((sum, i) => sum + i.amount, 0);

    return {
      period: { start: startDate, end: endDate },
      items,
      summary: {
        totalIncome,
        totalExpenses,
        netProfit: totalIncome - totalExpenses,
      },
    };
  }
}
