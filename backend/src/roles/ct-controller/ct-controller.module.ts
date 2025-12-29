import { Module } from '@nestjs/common';
import { FinesModule } from '../../modules/fines/fines.module';
import { TicketsModule } from '../../modules/tickets/tickets.module';
import { TransportCardsModule } from '../../modules/transport-cards/transport-cards.module';
import { CtControllerController } from './ct-controller.controller';
import { CtControllerService } from './ct-controller.service';

@Module({
  imports: [TransportCardsModule, TicketsModule, FinesModule],
  controllers: [CtControllerController],
  providers: [CtControllerService],
})
export class CtControllerModule {}
