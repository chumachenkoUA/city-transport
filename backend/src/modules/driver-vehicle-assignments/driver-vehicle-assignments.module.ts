import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { DriverVehicleAssignmentsController } from './driver-vehicle-assignments.controller';
import { DriverVehicleAssignmentsService } from './driver-vehicle-assignments.service';

@Module({
  imports: [DbModule],
  controllers: [DriverVehicleAssignmentsController],
  providers: [DriverVehicleAssignmentsService],
})
export class DriverVehicleAssignmentsModule {}
