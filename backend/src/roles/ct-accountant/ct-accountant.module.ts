import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { CtAccountantController } from './ct-accountant.controller';
import { CtAccountantService } from './ct-accountant.service';

@Module({
  imports: [DbModule],
  controllers: [CtAccountantController],
  providers: [CtAccountantService],
})
export class CtAccountantModule {}
