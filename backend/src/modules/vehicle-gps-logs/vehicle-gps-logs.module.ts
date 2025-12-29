import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { VehicleGpsLogsController } from './vehicle-gps-logs.controller';
import { VehicleGpsLogsService } from './vehicle-gps-logs.service';

@Module({
  imports: [DbModule],
  controllers: [VehicleGpsLogsController],
  providers: [VehicleGpsLogsService],
})
export class VehicleGpsLogsModule {}
