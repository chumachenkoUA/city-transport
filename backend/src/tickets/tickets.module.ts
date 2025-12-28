import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';

@Module({
  imports: [DbModule],
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
