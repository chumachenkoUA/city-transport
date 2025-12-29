import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './db/db.module';
import { CardTopUpsModule } from './modules/card-top-ups/card-top-ups.module';
import { ComplaintsSuggestionsModule } from './modules/complaints-suggestions/complaints-suggestions.module';
import { DriverVehicleAssignmentsModule } from './modules/driver-vehicle-assignments/driver-vehicle-assignments.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { FineAppealsModule } from './modules/fine-appeals/fine-appeals.module';
import { FinesModule } from './modules/fines/fines.module';
import { RoutePointsModule } from './modules/route-points/route-points.module';
import { RouteStopsModule } from './modules/route-stops/route-stops.module';
import { RoutesModule } from './modules/routes/routes.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { StopsModule } from './modules/stops/stops.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { TransportCardsModule } from './modules/transport-cards/transport-cards.module';
import { TransportTypesModule } from './modules/transport-types/transport-types.module';
import { TripsModule } from './modules/trips/trips.module';
import { UserGpsLogsModule } from './modules/user-gps-logs/user-gps-logs.module';
import { UsersModule } from './modules/users/users.module';
import { VehicleGpsLogsModule } from './modules/vehicle-gps-logs/vehicle-gps-logs.module';
import { VehiclesModule } from './modules/vehicles/vehicles.module';
import { CtControllerModule } from './roles/ct-controller/ct-controller.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DbModule,
    UsersModule,
    TransportTypesModule,
    StopsModule,
    RoutesModule,
    VehiclesModule,
    DriversModule,
    RouteStopsModule,
    RoutePointsModule,
    DriverVehicleAssignmentsModule,
    SchedulesModule,
    TripsModule,
    TransportCardsModule,
    CardTopUpsModule,
    TicketsModule,
    FinesModule,
    FineAppealsModule,
    ComplaintsSuggestionsModule,
    UserGpsLogsModule,
    VehicleGpsLogsModule,
    CtControllerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
