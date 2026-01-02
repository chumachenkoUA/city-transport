import { Module } from '@nestjs/common';
import { DriverVehicleAssignmentsModule } from '../../modules/driver-vehicle-assignments/driver-vehicle-assignments.module';
import { DriversModule } from '../../modules/drivers/drivers.module';
import { RoutePointsModule } from '../../modules/route-points/route-points.module';
import { RouteStopsModule } from '../../modules/route-stops/route-stops.module';
import { RoutesModule } from '../../modules/routes/routes.module';
import { SchedulesModule } from '../../modules/schedules/schedules.module';
import { VehicleGpsLogsModule } from '../../modules/vehicle-gps-logs/vehicle-gps-logs.module';
import { VehiclesModule } from '../../modules/vehicles/vehicles.module';
import { CtDispatcherController } from './ct-dispatcher.controller';
import { CtDispatcherService } from './ct-dispatcher.service';

@Module({
  imports: [
    DriversModule,
    VehiclesModule,
    RoutesModule,
    RouteStopsModule,
    RoutePointsModule,
    SchedulesModule,
    DriverVehicleAssignmentsModule,
    VehicleGpsLogsModule,
  ],
  controllers: [CtDispatcherController],
  providers: [CtDispatcherService],
})
export class CtDispatcherModule {}
