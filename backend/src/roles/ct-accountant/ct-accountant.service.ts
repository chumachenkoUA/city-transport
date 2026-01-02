import { BadRequestException, Injectable } from '@nestjs/common';
import { CardTopUpsService } from '../../modules/card-top-ups/card-top-ups.service';
import { ExpensesService } from '../../modules/expenses/expenses.service';
import { FinesService } from '../../modules/fines/fines.service';
import { SalaryPaymentsService } from '../../modules/salary-payments/salary-payments.service';
import { TicketsService } from '../../modules/tickets/tickets.service';
import { CreateExpenseDto } from '../../modules/expenses/dto/create-expense.dto';
import { CreateSalaryPaymentDto } from '../../modules/salary-payments/dto/create-salary-payment.dto';
import { ExpensesQueryDto } from './dto/expenses-query.dto';
import { PeriodDto } from './dto/period.dto';
import { SalariesQueryDto } from './dto/salaries-query.dto';

@Injectable()
export class CtAccountantService {
  constructor(
    private readonly expensesService: ExpensesService,
    private readonly salaryPaymentsService: SalaryPaymentsService,
    private readonly cardTopUpsService: CardTopUpsService,
    private readonly ticketsService: TicketsService,
    private readonly finesService: FinesService,
  ) {}

  createExpense(payload: CreateExpenseDto) {
    return this.expensesService.create(payload);
  }

  getExpenses(query: ExpensesQueryDto) {
    const { from, to } = this.parsePeriod(query);
    return this.expensesService.findByPeriod(from, to, query.category);
  }

  createSalary(payload: CreateSalaryPaymentDto) {
    return this.salaryPaymentsService.create(payload);
  }

  getSalaries(query: SalariesQueryDto) {
    const { from, to } = this.parsePeriod(query);
    return this.salaryPaymentsService.findByPeriod(from, to, query.role);
  }

  async getIncomeSummary(query: PeriodDto) {
    const { from, to } = this.parsePeriod(query);

    const [topUpsTotal, ticketsTotal, finesTotal] = await Promise.all([
      this.cardTopUpsService.sumByPeriod(from, to),
      this.ticketsService.sumByPeriod(from, to),
      this.finesService.sumPaidByPeriod(from, to),
    ]);

    return {
      from,
      to,
      topUpsTotal,
      ticketsTotal,
      finesTotal,
    };
  }

  async getReport(query: PeriodDto) {
    const { from, to } = this.parsePeriod(query);

    const [income, expensesTotal, salariesTotal] = await Promise.all([
      this.getIncomeSummary(query),
      this.expensesService.sumByPeriod(from, to),
      this.salaryPaymentsService.sumByPeriod(from, to),
    ]);

    const incomeSum =
      this.toNumber(income.topUpsTotal) +
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
