import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { StopsController } from './stops.controller';
import { StopsService } from './stops.service';

@Module({
  imports: [DbModule],
  controllers: [StopsController],
  providers: [StopsService],
  exports: [StopsService],
})
export class StopsModule {}
