import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { FinesController } from './fines.controller';
import { FinesService } from './fines.service';

@Module({
  imports: [DbModule],
  controllers: [FinesController],
  providers: [FinesService],
  exports: [FinesService],
})
export class FinesModule {}
