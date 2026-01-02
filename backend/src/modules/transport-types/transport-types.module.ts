import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { TransportTypesController } from './transport-types.controller';
import { TransportTypesService } from './transport-types.service';

@Module({
  imports: [DbModule],
  controllers: [TransportTypesController],
  providers: [TransportTypesService],
  exports: [TransportTypesService],
})
export class TransportTypesModule {}
