import { Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { CreateBudgetDto } from '../../modules/budgets/dto/create-budget.dto';
import { CreateExpenseDto } from '../../modules/expenses/dto/create-expense.dto';
import { CreateSalaryPaymentDto } from '../../modules/salary-payments/dto/create-salary-payment.dto';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { ExpensesQueryDto } from './dto/expenses-query.dto';
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
        ${payload.income}::numeric,
        ${payload.expenses}::numeric,
        ${payload.note}
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0].id };
  }

  async listBudgets(query: BudgetQueryDto) {
    const result = (await this.dbService.db.execute(sql`
      select id, month, planned_income as "plannedIncome", planned_expenses as "plannedExpenses", note
      from accountant_api.v_budgets
      limit ${query.limit ?? 50}
    `)) as unknown as { rows: Record<string, unknown>[] };
    return result.rows;
  }

  async createExpense(payload: CreateExpenseDto) {
    const occurredAt = payload.occurredAt ?? new Date();
    const result = (await this.dbService.db.execute(sql`
      select accountant_api.add_expense(
        ${payload.category},
        ${payload.amount}::numeric,
        ${payload.description ?? null},
        ${payload.documentRef ?? null},
        ${occurredAt}::timestamp
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0].id };
  }

  async getExpenses(query: ExpensesQueryDto) {
    const result = (await this.dbService.db.execute(sql`
      select * from accountant_api.v_expenses
      limit ${query.limit ?? 50}
    `)) as unknown as { rows: Record<string, unknown>[] };
    return result.rows;
  }

  async createSalary(payload: CreateSalaryPaymentDto) {
    const result = (await this.dbService.db.execute(sql`
      select accountant_api.pay_salary(
        ${payload.driverId ?? null}::bigint,
        ${payload.employeeName ?? null},
        ${payload.employeeRole ?? 'Інше'},
        ${payload.rate ?? 0}::numeric,
        ${payload.units ?? 0}::integer,
        ${payload.total ?? 0}::numeric
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0].id };
  }

  async getSalaries(query: SalariesQueryDto) {
    const result = (await this.dbService.db.execute(sql`
      select id, paid_at as "paidAt", employee_name as "employeeName", role, total
      from accountant_api.v_salary_history
      limit ${query.limit ?? 50}
    `)) as unknown as { rows: Record<string, unknown>[] };
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
