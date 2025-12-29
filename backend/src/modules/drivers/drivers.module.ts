import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  imports: [DbModule],
  controllers: [DriversController],
  providers: [DriversService],
})
export class DriversModule {}
