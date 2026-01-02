import { Module } from '@nestjs/common';
import { DriverVehicleAssignmentsModule } from '../../modules/driver-vehicle-assignments/driver-vehicle-assignments.module';
import { DriversModule } from '../../modules/drivers/drivers.module';
import { RoutePointsModule } from '../../modules/route-points/route-points.module';
import { RouteStopsModule } from '../../modules/route-stops/route-stops.module';
import { RoutesModule } from '../../modules/routes/routes.module';
import { SchedulesModule } from '../../modules/schedules/schedules.module';
import { TripsModule } from '../../modules/trips/trips.module';
import { VehiclesModule } from '../../modules/vehicles/vehicles.module';
import { CtDriverController } from './ct-driver.controller';
import { CtDriverService } from './ct-driver.service';

@Module({
  imports: [
    DriversModule,
    VehiclesModule,
    RoutesModule,
    RouteStopsModule,
    RoutePointsModule,
    DriverVehicleAssignmentsModule,
    SchedulesModule,
    TripsModule,
  ],
  controllers: [CtDriverController],
  providers: [CtDriverService],
})
export class CtDriverModule {}
