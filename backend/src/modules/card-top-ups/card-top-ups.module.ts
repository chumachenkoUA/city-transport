import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { CardTopUpsController } from './card-top-ups.controller';
import { CardTopUpsService } from './card-top-ups.service';

@Module({
  imports: [DbModule],
  controllers: [CardTopUpsController],
  providers: [CardTopUpsService],
})
export class CardTopUpsModule {}
