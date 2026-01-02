import { Module } from '@nestjs/common';
import { BudgetsModule } from '../../modules/budgets/budgets.module';
import { CardTopUpsModule } from '../../modules/card-top-ups/card-top-ups.module';
import { ExpensesModule } from '../../modules/expenses/expenses.module';
import { FinesModule } from '../../modules/fines/fines.module';
import { SalaryPaymentsModule } from '../../modules/salary-payments/salary-payments.module';
import { TicketsModule } from '../../modules/tickets/tickets.module';
import { CtAccountantController } from './ct-accountant.controller';
import { CtAccountantService } from './ct-accountant.service';

@Module({
  imports: [
    BudgetsModule,
    ExpensesModule,
    SalaryPaymentsModule,
    CardTopUpsModule,
    TicketsModule,
    FinesModule,
  ],
  controllers: [CtAccountantController],
  providers: [CtAccountantService],
})
export class CtAccountantModule {}
