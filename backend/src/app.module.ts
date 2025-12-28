import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CardTopUpsModule } from './card-top-ups/card-top-ups.module';
import { ComplaintsSuggestionsModule } from './complaints-suggestions/complaints-suggestions.module';
import { DbModule } from './db/db.module';
import { DriverVehicleAssignmentsModule } from './driver-vehicle-assignments/driver-vehicle-assignments.module';
import { DriversModule } from './drivers/drivers.module';
import { FineAppealsModule } from './fine-appeals/fine-appeals.module';
import { FinesModule } from './fines/fines.module';
import { RoutePointsModule } from './route-points/route-points.module';
import { RouteStopsModule } from './route-stops/route-stops.module';
import { RoutesModule } from './routes/routes.module';
import { SchedulesModule } from './schedules/schedules.module';
import { StopsModule } from './stops/stops.module';
import { TicketsModule } from './tickets/tickets.module';
import { TransportCardsModule } from './transport-cards/transport-cards.module';
import { TransportTypesModule } from './transport-types/transport-types.module';
import { TripsModule } from './trips/trips.module';
import { UserGpsLogsModule } from './user-gps-logs/user-gps-logs.module';
import { UsersModule } from './users/users.module';
import { VehicleGpsLogsModule } from './vehicle-gps-logs/vehicle-gps-logs.module';
import { VehiclesModule } from './vehicles/vehicles.module';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
