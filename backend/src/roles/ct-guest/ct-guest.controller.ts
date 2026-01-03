import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CtGuestService } from './ct-guest.service';
import { RouteLookupDto } from './dto/route-lookup.dto';
import { RoutesListDto } from './dto/routes-list.dto';
import { RoutesBetweenDto } from './dto/routes-between.dto';
import { RouteScheduleDto } from './dto/route-schedule.dto';
import { StopsNearDto } from './dto/stops-near.dto';

@Controller('guest')
export class CtGuestController {
  constructor(private readonly ctGuestService: CtGuestService) {}

  @Get('transport-types')
  listTransportTypes() {
    return this.ctGuestService.listTransportTypes();
  }

  @Get('routes')
  listRoutes(@Query() query: RoutesListDto) {
    return this.ctGuestService.listRoutes(query.transportTypeId);
  }

  @Get('stops/near')
  getStopsNear(@Query() query: StopsNearDto) {
    return this.ctGuestService.getStopsNear(query);
  }

  @Get('stops/:stopId/routes')
  getRoutesByStop(@Param('stopId') stopId: string) {
    return this.ctGuestService.getRoutesByStop(Number(stopId));
  }

  @Get('routes/stops')
  getRouteStops(@Query() query: RouteLookupDto) {
    return this.ctGuestService.getRouteStops(query);
  }

  @Get('routes/points')
  getRoutePoints(@Query() query: RouteLookupDto) {
    return this.ctGuestService.getRoutePoints(query);
  }

  @Get('routes/near')
  getRoutesBetween(@Query() query: RoutesBetweenDto) {
    return this.ctGuestService.getRoutesBetween(query);
  }

  @Get('routes/schedule')
  getSchedule(@Query() query: RouteScheduleDto) {
    return this.ctGuestService.getSchedule(query);
  }
}
