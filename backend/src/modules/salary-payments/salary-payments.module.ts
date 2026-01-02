import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { SalaryPaymentsController } from './salary-payments.controller';
import { SalaryPaymentsService } from './salary-payments.service';

@Module({
  imports: [DbModule],
  controllers: [SalaryPaymentsController],
  providers: [SalaryPaymentsService],
  exports: [SalaryPaymentsService],
})
export class SalaryPaymentsModule {}
