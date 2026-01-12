import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CreateStopDto } from '../../modules/stops/dto/create-stop.dto';
import { UpdateStopDto } from '../../modules/stops/dto/update-stop.dto';
import { CtMunicipalityService } from './ct-municipality.service';
import { MunicipalityComplaintsQueryDto } from './dto/complaints-query.dto';
import { CreateMunicipalityRouteDto } from './dto/create-route.dto';
import { PassengerFlowQueryDto } from './dto/passenger-flow-query.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';
import { UpdateRouteStatusDto } from './dto/update-route-status.dto';

@Controller('municipality')
export class CtMunicipalityController {
  constructor(private readonly ctMunicipalityService: CtMunicipalityService) {}

  @Get('transport-types')
  listTransportTypes() {
    return this.ctMunicipalityService.listTransportTypes();
  }

  @Get('stops')
  listStops() {
    return this.ctMunicipalityService.listStops();
  }

  @Post('stops')
  createStop(@Body() payload: CreateStopDto) {
    return this.ctMunicipalityService.createStop(payload);
  }

  @Patch('stops/:id')
  updateStop(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateStopDto,
  ) {
    return this.ctMunicipalityService.updateStop(id, payload);
  }

  @Get('routes')
  listRoutes() {
    return this.ctMunicipalityService.listRoutes();
  }

  @Patch('routes/:routeId/active')
  setRouteActive(
    @Param('routeId', ParseIntPipe) routeId: number,
    @Body() payload: UpdateRouteStatusDto,
  ) {
    return this.ctMunicipalityService.setRouteActive(routeId, payload.isActive);
  }

  @Post('routes')
  createRoute(@Body() payload: CreateMunicipalityRouteDto) {
    return this.ctMunicipalityService.createRoute(payload);
  }

  @Get('routes/:routeId/stops')
  listRouteStops(@Param('routeId', ParseIntPipe) routeId: number) {
    return this.ctMunicipalityService.listRouteStops(routeId);
  }

  @Get('routes/:routeId/points')
  listRoutePoints(@Param('routeId', ParseIntPipe) routeId: number) {
    return this.ctMunicipalityService.listRoutePoints(routeId);
  }

  @Get('passenger-flow')
  getPassengerFlow(@Query() query: PassengerFlowQueryDto) {
    return this.ctMunicipalityService.getPassengerFlow(query);
  }

  @Get('complaints')
  getComplaints(@Query() query: MunicipalityComplaintsQueryDto) {
    return this.ctMunicipalityService.getComplaints(query);
  }

  @Patch('complaints/:id/status')
  updateComplaintStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateComplaintStatusDto,
  ) {
    return this.ctMunicipalityService.updateComplaintStatus(id, payload.status);
  }
}
