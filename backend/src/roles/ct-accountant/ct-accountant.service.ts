import { BadRequestException, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { CreateBudgetDto } from '../../modules/budgets/dto/create-budget.dto';
import { CreateExpenseDto } from '../../modules/expenses/dto/create-expense.dto';
import { CreateSalaryPaymentDto } from '../../modules/salary-payments/dto/create-salary-payment.dto';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { ExpensesQueryDto } from './dto/expenses-query.dto';
import { PeriodDto } from './dto/period.dto';
import { SalariesQueryDto } from './dto/salaries-query.dto';

type BudgetRow = {
  id: number;
  month: string;
  income: string;
  expenses: string;
  note: string | null;
};

type ExpenseRow = {
  id: number;
  category: string;
  amount: string;
  description: string | null;
  documentRef: string | null;
  occurredAt: Date;
};

type SalaryRow = {
  id: number;
  driverId: number | null;
  employeeName: string | null;
  employeeRole: string | null;
  rate: string | null;
  units: number | null;
  total: string;
  paidAt: Date;
};

type IncomeRow = {
  topupsTotal: string;
  ticketsTotal: string;
  finesTotal: string;
};

@Injectable()
export class CtAccountantService {
  constructor(private readonly dbService: DbService) {}

  async listBudgets(query: BudgetQueryDto) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        month as "month",
        income as "income",
        expenses as "expenses",
        note as "note"
      from accountant_api.v_budgets
      ${query.month ? sql`where month = ${query.month}` : sql``}
      order by month desc
    `)) as unknown as { rows: BudgetRow[] };

    return result.rows;
  }

  async upsertBudget(payload: CreateBudgetDto) {
    const result = (await this.dbService.db.execute(sql`
      select accountant_api.upsert_budget(
        ${payload.month},
        ${payload.income},
        ${payload.expenses},
        ${payload.note ?? null}
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0]?.id };
  }

  async createExpense(payload: CreateExpenseDto) {
    const result = (await this.dbService.db.execute(sql`
      select accountant_api.create_expense(
        ${payload.category},
        ${payload.amount},
        ${payload.description ?? null},
        ${payload.occurredAt ?? null},
        ${payload.documentRef ?? null}
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0]?.id };
  }

  async getExpenses(query: ExpensesQueryDto) {
    const { from, to } = this.parsePeriod(query);

    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        category as "category",
        amount as "amount",
        description as "description",
        document_ref as "documentRef",
        occurred_at as "occurredAt"
      from accountant_api.expenses_by_period(
        ${from},
        ${to},
        ${query.category ?? null}
      )
    `)) as unknown as { rows: ExpenseRow[] };

    return result.rows;
  }

  async createSalary(payload: CreateSalaryPaymentDto) {
    const result = (await this.dbService.db.execute(sql`
      select accountant_api.create_salary_payment(
        ${payload.driverId ?? null},
        ${payload.employeeName ?? null},
        ${payload.employeeRole ?? null},
        ${payload.rate ?? null},
        ${payload.units ?? null},
        ${payload.total},
        ${payload.paidAt ?? null}
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0]?.id };
  }

  async getSalaries(query: SalariesQueryDto) {
    const { from, to } = this.parsePeriod(query);

    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        driver_id as "driverId",
        employee_name as "employeeName",
        employee_role as "employeeRole",
        rate as "rate",
        units as "units",
        total as "total",
        paid_at as "paidAt"
      from accountant_api.salaries_by_period(
        ${from},
        ${to},
        ${query.role ?? null}
      )
    `)) as unknown as { rows: SalaryRow[] };

    return result.rows;
  }

  async getIncomeSummary(query: PeriodDto) {
    const { from, to } = this.parsePeriod(query);

    const result = (await this.dbService.db.execute(sql`
      select
        topups_total as "topupsTotal",
        tickets_total as "ticketsTotal",
        fines_total as "finesTotal"
      from accountant_api.income_summary(${from}, ${to})
    `)) as unknown as { rows: IncomeRow[] };

    return {
      from,
      to,
      ...(result.rows[0] ?? {
        topupsTotal: '0',
        ticketsTotal: '0',
        finesTotal: '0',
      }),
    };
  }

  async getReport(query: PeriodDto) {
    const { from, to } = this.parsePeriod(query);

    const [income, expensesTotal, salariesTotal] = await Promise.all([
      this.getIncomeSummary(query),
      this.sumExpenses(from, to),
      this.sumSalaries(from, to),
    ]);

    const incomeSum =
      this.toNumber(income.topupsTotal) +
      this.toNumber(income.ticketsTotal) +
      this.toNumber(income.finesTotal);
    const expensesSum =
      this.toNumber(expensesTotal) + this.toNumber(salariesTotal);

    return {
      from,
      to,
      income,
      expensesTotal,
      salariesTotal,
      net: (incomeSum - expensesSum).toFixed(2),
    };
  }

  private async sumExpenses(from: Date, to: Date) {
    const result = (await this.dbService.db.execute(sql`
      select coalesce(sum(amount), 0) as total
      from accountant_api.expenses_by_period(${from}, ${to}, ${null})
    `)) as unknown as { rows: Array<{ total: string }> };

    return result.rows[0]?.total ?? '0';
  }

  private async sumSalaries(from: Date, to: Date) {
    const result = (await this.dbService.db.execute(sql`
      select coalesce(sum(total), 0) as total
      from accountant_api.salaries_by_period(${from}, ${to}, ${null})
    `)) as unknown as { rows: Array<{ total: string }> };

    return result.rows[0]?.total ?? '0';
  }

  private parsePeriod(query: { from: string; to: string }) {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid period dates');
    }

    if (from > to) {
      throw new BadRequestException('from must be before to');
    }

    return { from, to };
  }

  private toNumber(value: string | undefined) {
    return value ? Number(value) : 0;
  }
}
