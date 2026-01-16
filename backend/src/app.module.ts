import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthSessionMiddleware } from './common/session/auth-session.middleware';
import { SessionModule } from './common/session/session.module';
import { DbModule } from './db/db.module';
import { AuthModule } from './modules/auth/auth.module';
import { BudgetsModule } from './modules/budgets/budgets.module';
import { CardTopUpsModule } from './modules/card-top-ups/card-top-ups.module';
import { ComplaintsSuggestionsModule } from './modules/complaints-suggestions/complaints-suggestions.module';
import { DriverVehicleAssignmentsModule } from './modules/driver-vehicle-assignments/driver-vehicle-assignments.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { FineAppealsModule } from './modules/fine-appeals/fine-appeals.module';
import { FinesModule } from './modules/fines/fines.module';
import { RoutePointsModule } from './modules/route-points/route-points.module';
import { RouteStopsModule } from './modules/route-stops/route-stops.module';
import { RoutesModule } from './modules/routes/routes.module';
import { SalaryPaymentsModule } from './modules/salary-payments/salary-payments.module';
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
import { CtAccountantModule } from './roles/ct-accountant/ct-accountant.module';
import { CtDispatcherModule } from './roles/ct-dispatcher/ct-dispatcher.module';
import { CtDriverModule } from './roles/ct-driver/ct-driver.module';
import { CtGuestModule } from './roles/ct-guest/ct-guest.module';
import { CtManagerModule } from './roles/ct-manager/ct-manager.module';
import { CtMunicipalityModule } from './roles/ct-municipality/ct-municipality.module';
import { CtPassengerModule } from './roles/ct-passenger/ct-passenger.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SessionModule,
    DbModule,
    AuthModule,
    BudgetsModule,
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
    SalaryPaymentsModule,
    TransportCardsModule,
    CardTopUpsModule,
    TicketsModule,
    FinesModule,
    FineAppealsModule,
    ComplaintsSuggestionsModule,
    UserGpsLogsModule,
    VehicleGpsLogsModule,
    CtControllerModule,
    CtAccountantModule,
    CtDispatcherModule,
    CtDriverModule,
    CtGuestModule,
    CtManagerModule,
    CtMunicipalityModule,
    CtPassengerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthSessionMiddleware).forRoutes('*');
  }
}
