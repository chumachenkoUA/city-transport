import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { BudgetsService } from '../../modules/budgets/budgets.service';
import { CreateBudgetDto } from '../../modules/budgets/dto/create-budget.dto';
import { UpdateBudgetDto } from '../../modules/budgets/dto/update-budget.dto';
import { CreateExpenseDto } from '../../modules/expenses/dto/create-expense.dto';
import { CreateSalaryPaymentDto } from '../../modules/salary-payments/dto/create-salary-payment.dto';
import { CtAccountantService } from './ct-accountant.service';
import { BudgetQueryDto } from './dto/budget-query.dto';
import { ExpensesQueryDto } from './dto/expenses-query.dto';
import { PeriodDto } from './dto/period.dto';
import { SalariesQueryDto } from './dto/salaries-query.dto';

@Controller('accountant')
export class CtAccountantController {
  constructor(
    private readonly ctAccountantService: CtAccountantService,
    private readonly budgetsService: BudgetsService,
  ) {}

  @Get('budgets')
  getBudgets(@Query() query: BudgetQueryDto) {
    if (query.month) {
      return this.budgetsService.findByMonth(query.month);
    }

    return this.budgetsService.findAll();
  }

  @Get('budgets/:id')
  getBudget(@Param('id', ParseIntPipe) id: number) {
    return this.budgetsService.findOne(id);
  }

  @Post('budgets')
  createBudget(@Body() payload: CreateBudgetDto) {
    return this.budgetsService.create(payload);
  }

  @Patch('budgets/:id')
  updateBudget(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateBudgetDto,
  ) {
    return this.budgetsService.update(id, payload);
  }

  @Post('expenses')
  createExpense(@Body() payload: CreateExpenseDto) {
    return this.ctAccountantService.createExpense(payload);
  }

  @Get('expenses')
  getExpenses(@Query() query: ExpensesQueryDto) {
    return this.ctAccountantService.getExpenses(query);
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
