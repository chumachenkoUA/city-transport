import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateBudgetDto } from '../../modules/budgets/dto/create-budget.dto';
import { CreateSalaryPaymentDto } from '../../modules/salary-payments/dto/create-salary-payment.dto';
import { CtAccountantService } from './ct-accountant.service';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateIncomeDto } from './dto/create-income.dto';
import { ExpensesQueryDto } from './dto/expenses-query.dto';
import { IncomesQueryDto } from './dto/incomes-query.dto';
import { PeriodDto } from './dto/period.dto';
import { SalariesQueryDto } from './dto/salaries-query.dto';

@Controller('accountant')
export class CtAccountantController {
  constructor(private readonly ctAccountantService: CtAccountantService) {}

  @Get('budgets')
  getBudgets(@Query() query: BudgetQueryDto) {
    return this.ctAccountantService.listBudgets(query);
  }

  @Post('budgets')
  upsertBudget(@Body() payload: CreateBudgetDto) {
    return this.ctAccountantService.upsertBudget(payload);
  }

  @Post('expenses')
  createExpense(@Body() payload: CreateExpenseDto) {
    return this.ctAccountantService.createExpense(payload);
  }

  @Get('expenses')
  getExpenses(@Query() query: ExpensesQueryDto) {
    return this.ctAccountantService.getExpenses(query);
  }

  @Post('incomes')
  createIncome(@Body() payload: CreateIncomeDto) {
    return this.ctAccountantService.createIncome(payload);
  }

  @Get('incomes')
  getIncomes(@Query() query: IncomesQueryDto) {
    return this.ctAccountantService.getIncomes(query);
  }

  @Get('drivers')
  getDrivers() {
    return this.ctAccountantService.getDrivers();
  }

  @Post('salaries')
  createSalary(@Body() payload: CreateSalaryPaymentDto) {
    return this.ctAccountantService.createSalary(payload);
  }

  @Get('salaries')
  getSalaries(@Query() query: SalariesQueryDto) {
    return this.ctAccountantService.getSalaries(query);
  }

  @Get('income')
  getIncome(@Query() query: PeriodDto) {
    return this.ctAccountantService.getIncomeSummary(query);
  }

  @Get('report')
  getReport(@Query() query: PeriodDto) {
    return this.ctAccountantService.getReport(query);
  }
}
