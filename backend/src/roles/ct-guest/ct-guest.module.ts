import { Module } from '@nestjs/common';
import { ComplaintsSuggestionsModule } from '../../modules/complaints-suggestions/complaints-suggestions.module';
import { RoutePointsModule } from '../../modules/route-points/route-points.module';
import { RouteStopsModule } from '../../modules/route-stops/route-stops.module';
import { RoutesModule } from '../../modules/routes/routes.module';
import { SchedulesModule } from '../../modules/schedules/schedules.module';
import { StopsModule } from '../../modules/stops/stops.module';
import { CtGuestController } from './ct-guest.controller';
import { CtGuestService } from './ct-guest.service';

@Module({
  imports: [
    StopsModule,
    RouteStopsModule,
    RoutePointsModule,
    RoutesModule,
    SchedulesModule,
    ComplaintsSuggestionsModule,
  ],
  controllers: [CtGuestController],
  providers: [CtGuestService],
  exports: [CtGuestService],
})
export class CtGuestModule {}
