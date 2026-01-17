import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CtPassengerService } from './ct-passenger.service';
import { CreateAppealDto } from './dto/create-appeal.dto';
import { CreatePassengerComplaintDto } from './dto/create-complaint.dto';
import { TopUpDto } from './dto/top-up.dto';
import { RouteLookupDto } from '../ct-guest/dto/route-lookup.dto';
import { RouteScheduleDto } from '../ct-guest/dto/route-schedule.dto';
import { RoutesBetweenDto } from '../ct-guest/dto/routes-between.dto';
import { StopsNearDto } from '../ct-guest/dto/stops-near.dto';
import { BuyTicketDto } from './dto/buy-ticket.dto';

import { PayFineDto } from './dto/pay-fine.dto';

@Controller('passenger')
export class CtPassengerController {
  constructor(private readonly ctPassengerService: CtPassengerService) {}

  @Get('profile')
  getMyProfile() {
    return this.ctPassengerService.getMyProfile();
  }

  @Post('fines/:fineId/pay')
  payFine(@Param('fineId') fineId: string, @Body() payload: PayFineDto) {
    return this.ctPassengerService.payFine(Number(fineId), payload);
  }

  @Get('stops/near')
  getStopsNear(@Query() query: StopsNearDto) {
    return this.ctPassengerService.getStopsNear(query);
  }

  @Get('stops/:stopId/routes')
  getRoutesByStop(@Param('stopId') stopId: string) {
    return this.ctPassengerService.getRoutesByStop(Number(stopId));
  }

  @Get('routes/stops')
  getRouteStops(@Query() query: RouteLookupDto) {
    return this.ctPassengerService.getRouteStops(query);
  }

  @Get('routes/points')
  getRoutePoints(@Query() query: RouteLookupDto) {
    return this.ctPassengerService.getRoutePoints(query);
  }

  @Get('routes/plan')
  planRoute(@Query() query: any) {
    return this.ctPassengerService.planRoute({
      lonA: Number(query.lonA),
      latA: Number(query.latA),
      lonB: Number(query.lonB),
      latB: Number(query.latB),
      radius: query.radius ? Number(query.radius) : undefined,
      maxWaitMin: query.maxWaitMin ? Number(query.maxWaitMin) : undefined,
      maxResults: query.maxResults ? Number(query.maxResults) : undefined,
    });
  }

  @Get('routes/schedule')
  getSchedule(@Query() query: RouteScheduleDto) {
    return this.ctPassengerService.getSchedule(query);
  }

  @Post('complaints')
  createComplaint(@Body() payload: CreatePassengerComplaintDto) {
    return this.ctPassengerService.createComplaint(payload);
  }

  @Get('card')
  getMyCard() {
    return this.ctPassengerService.getMyCard();
  }

  @Post('cards/:cardNumber/top-up')
  topUpCard(
    @Param('cardNumber') cardNumber: string,
    @Body() payload: TopUpDto,
  ) {
    return this.ctPassengerService.topUpCard(cardNumber, payload);
  }

  @Get('card/top-ups')
  getMyTopUps(@Query('limit') limit?: string) {
    return this.ctPassengerService.getMyTopUps(limit ? Number(limit) : 3);
  }

  @Post('tickets/buy')
  buyTicket(@Body() payload: BuyTicketDto) {
    return this.ctPassengerService.buyTicket(payload);
  }

  @Get('trips')
  getTrips() {
    return this.ctPassengerService.getMyTrips();
  }

  @Get('fines')
  getFines() {
    return this.ctPassengerService.getMyFines();
  }

  @Get('fines/:fineId')
  getFine(@Param('fineId') fineId: string) {
    return this.ctPassengerService.getFineDetails(Number(fineId));
  }

  @Post('fines/:fineId/appeals')
  createAppeal(
    @Param('fineId') fineId: string,
    @Body() payload: CreateAppealDto,
  ) {
    return this.ctPassengerService.createAppeal(Number(fineId), payload);
  }
}
