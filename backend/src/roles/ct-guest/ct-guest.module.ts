import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { CtGuestController } from './ct-guest.controller';
import { CtGuestService } from './ct-guest.service';

@Module({
  imports: [DbModule],
  controllers: [CtGuestController],
  providers: [CtGuestService],
  exports: [CtGuestService],
})
export class CtGuestModule {}
