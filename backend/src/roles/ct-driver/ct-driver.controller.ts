import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestContextService } from '../../common/session/request-context.service';
import { CtDriverService } from './ct-driver.service';
import { FinishTripDto } from './dto/finish-trip.dto';
import { GpsLogDto } from './dto/gps-log.dto';
import { PassengerCountDto } from './dto/passenger-count.dto';
import { RouteLookupDto } from './dto/route-lookup.dto';
import { StartTripDto } from './dto/start-trip.dto';

@Controller('driver')
export class CtDriverController {
  constructor(
    private readonly ctDriverService: CtDriverService,
    private readonly contextService: RequestContextService,
  ) {}

  @Get('me')
  getProfile() {
    return this.ctDriverService.getProfile(this.requireLogin());
  }

  @Get('schedule')
  getScheduleByDate(@Query('date') date?: string) {
    return this.ctDriverService.getScheduleByLogin(this.requireLogin(), date);
  }

  @Get('active-trip')
  getActiveTrip() {
    return this.ctDriverService.getActiveTripByLogin(this.requireLogin());
  }

  @Get('routes/stops')
  getRouteStops(@Query() query: RouteLookupDto) {
    return this.ctDriverService.getRouteStops(query);
  }

  @Get('routes/points')
  getRoutePoints(@Query() query: RouteLookupDto) {
    return this.ctDriverService.getRoutePoints(query);
  }

  @Post('trips/start')
  startTrip(@Body() payload: StartTripDto) {
    return this.ctDriverService.startTrip(this.requireLogin(), payload);
  }

  @Post('trips/finish')
  finishTrip(@Body() payload: FinishTripDto) {
    return this.ctDriverService.finishTrip(this.requireLogin(), payload);
  }

  @Post('trips/passengers')
  setPassengerCount(@Body() payload: PassengerCountDto) {
    return this.ctDriverService.setPassengerCount(this.requireLogin(), payload);
  }

  @Post('trips/gps')
  sendGps(@Body() payload: GpsLogDto) {
    return this.ctDriverService.logGps(this.requireLogin(), payload);
  }

  private requireLogin() {
    const session = this.contextService.get();
    if (!session?.login) {
      throw new UnauthorizedException('Missing auth session');
    }
    return session.login;
  }
}
