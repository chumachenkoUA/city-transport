import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { TransportCardsController } from './transport-cards.controller';
import { TransportCardsService } from './transport-cards.service';

@Module({
  imports: [DbModule],
  controllers: [TransportCardsController],
  providers: [TransportCardsService],
  exports: [TransportCardsService],
})
export class TransportCardsModule {}
