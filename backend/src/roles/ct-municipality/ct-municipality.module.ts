import { Module } from '@nestjs/common';
import { ComplaintsSuggestionsModule } from '../../modules/complaints-suggestions/complaints-suggestions.module';
import { RoutePointsModule } from '../../modules/route-points/route-points.module';
import { RouteStopsModule } from '../../modules/route-stops/route-stops.module';
import { RoutesModule } from '../../modules/routes/routes.module';
import { StopsModule } from '../../modules/stops/stops.module';
import { TransportTypesModule } from '../../modules/transport-types/transport-types.module';
import { TripsModule } from '../../modules/trips/trips.module';
import { CtMunicipalityController } from './ct-municipality.controller';
import { CtMunicipalityService } from './ct-municipality.service';

@Module({
  imports: [
    StopsModule,
    RoutesModule,
    RouteStopsModule,
    RoutePointsModule,
    TransportTypesModule,
    TripsModule,
    ComplaintsSuggestionsModule,
  ],
  controllers: [CtMunicipalityController],
  providers: [CtMunicipalityService],
})
export class CtMunicipalityModule {}
