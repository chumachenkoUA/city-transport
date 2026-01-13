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
    this.requireLogin();
    return this.ctDriverService.getProfile();
  }

  @Get('schedule')
  getScheduleByDate(@Query('date') date?: string) {
    this.requireLogin();
    return this.ctDriverService.getScheduleByLogin(date);
  }

  @Get('active-trip')
  getActiveTrip() {
    this.requireLogin();
    return this.ctDriverService.getActiveTrip();
  }

  @Get('scheduled-trips')
  getScheduledTrips() {
    this.requireLogin();
    return this.ctDriverService.getScheduledTrips();
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
    this.requireLogin();
    return this.ctDriverService.startTrip(payload);
  }

  @Post('trips/finish')
  finishTrip(@Body() payload: FinishTripDto) {
    this.requireLogin();
    return this.ctDriverService.finishTrip(payload);
  }

  @Post('trips/passengers')
  setPassengerCount(@Body() payload: PassengerCountDto) {
    this.requireLogin();
    return this.ctDriverService.setPassengerCount(payload);
  }

  @Post('trips/gps')
  sendGps(@Body() payload: GpsLogDto) {
    this.requireLogin();
    return this.ctDriverService.logGps(payload);
  }

  private requireLogin() {
    const session = this.contextService.get();
    if (!session?.login) {
      throw new UnauthorizedException('Missing auth session');
    }
    return session.login;
  }
}
