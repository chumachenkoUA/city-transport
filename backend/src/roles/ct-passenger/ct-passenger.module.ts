import { Module } from '@nestjs/common';
import { CardTopUpsModule } from '../../modules/card-top-ups/card-top-ups.module';
import { ComplaintsSuggestionsModule } from '../../modules/complaints-suggestions/complaints-suggestions.module';
import { FineAppealsModule } from '../../modules/fine-appeals/fine-appeals.module';
import { FinesModule } from '../../modules/fines/fines.module';
import { TicketsModule } from '../../modules/tickets/tickets.module';
import { TransportCardsModule } from '../../modules/transport-cards/transport-cards.module';
import { CtGuestModule } from '../ct-guest/ct-guest.module';
import { CtPassengerController } from './ct-passenger.controller';
import { CtPassengerService } from './ct-passenger.service';

@Module({
  imports: [
    CtGuestModule,
    TransportCardsModule,
    CardTopUpsModule,
    TicketsModule,
    FinesModule,
    FineAppealsModule,
    ComplaintsSuggestionsModule,
  ],
  controllers: [CtPassengerController],
  providers: [CtPassengerService],
})
export class CtPassengerModule {}
