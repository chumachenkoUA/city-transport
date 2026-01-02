import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CreateStopDto } from '../../modules/stops/dto/create-stop.dto';
import { CtMunicipalityService } from './ct-municipality.service';
import { MunicipalityComplaintsQueryDto } from './dto/complaints-query.dto';
import { CreateMunicipalityRouteDto } from './dto/create-route.dto';
import { PassengerFlowQueryDto } from './dto/passenger-flow-query.dto';

@Controller('municipality')
export class CtMunicipalityController {
  constructor(private readonly ctMunicipalityService: CtMunicipalityService) {}

  @Post('stops')
  createStop(@Body() payload: CreateStopDto) {
    return this.ctMunicipalityService.createStop(payload);
  }

  @Post('routes')
  createRoute(@Body() payload: CreateMunicipalityRouteDto) {
    return this.ctMunicipalityService.createRoute(payload);
  }

  @Get('passenger-flow')
  getPassengerFlow(@Query() query: PassengerFlowQueryDto) {
    return this.ctMunicipalityService.getPassengerFlow(query);
  }

  @Get('complaints')
  getComplaints(@Query() query: MunicipalityComplaintsQueryDto) {
    return this.ctMunicipalityService.getComplaints(query);
  }
}
