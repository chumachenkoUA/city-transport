import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CtDriverService } from './ct-driver.service';
import { FinishTripDto } from './dto/finish-trip.dto';
import { PassengerCountDto } from './dto/passenger-count.dto';
import { RouteLookupDto } from './dto/route-lookup.dto';
import { StartTripDto } from './dto/start-trip.dto';

@Controller('driver')
export class CtDriverController {
  constructor(private readonly ctDriverService: CtDriverService) {}

  @Get(':driverId/schedule')
  getSchedule(@Param('driverId', ParseIntPipe) driverId: number) {
    return this.ctDriverService.getSchedule(driverId);
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
    return this.ctDriverService.startTrip(payload);
  }

  @Post('trips/finish')
  finishTrip(@Body() payload: FinishTripDto) {
    return this.ctDriverService.finishTrip(payload);
  }

  @Post('trips/passengers')
  setPassengerCount(@Body() payload: PassengerCountDto) {
    return this.ctDriverService.setPassengerCount(payload);
  }
}
