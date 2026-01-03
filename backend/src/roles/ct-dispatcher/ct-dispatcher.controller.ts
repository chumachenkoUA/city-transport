import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CtDispatcherService } from './ct-dispatcher.service';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { CreateDispatcherScheduleDto } from './dto/create-schedule.dto';
import { DetectDeviationDto } from './dto/deviation.dto';
import { UpdateDispatcherScheduleDto } from './dto/update-schedule.dto';

@Controller('dispatcher')
export class CtDispatcherController {
  constructor(private readonly ctDispatcherService: CtDispatcherService) {}

  @Post('schedules')
  createSchedule(@Body() payload: CreateDispatcherScheduleDto) {
    return this.ctDispatcherService.createSchedule(payload);
  }

  @Get('routes')
  listRoutes() {
    return this.ctDispatcherService.listRoutes();
  }

  @Get('dashboard')
  getDashboard() {
    return this.ctDispatcherService.getDashboard();
  }

  @Get('assignments')
  listAssignments() {
    return this.ctDispatcherService.listAssignments();
  }

  @Get('active-trips')
  listActiveTrips() {
    return this.ctDispatcherService.listActiveTrips();
  }

  @Get('deviations')
  listDeviations() {
    return this.ctDispatcherService.listDeviations();
  }

  @Get('schedules')
  listSchedules() {
    return this.ctDispatcherService.listSchedules();
  }

  @Patch('schedules/:id')
  updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateDispatcherScheduleDto,
  ) {
    return this.ctDispatcherService.updateSchedule(id, payload);
  }

  @Get('schedules/:id')
  getSchedule(@Param('id', ParseIntPipe) id: number) {
    return this.ctDispatcherService.getScheduleDetails(id);
  }

  @Get('routes/:routeId/points')
  getRoutePoints(@Param('routeId', ParseIntPipe) routeId: number) {
    return this.ctDispatcherService.getRoutePoints(routeId);
  }

  @Get('drivers')
  listDrivers() {
    return this.ctDispatcherService.listDrivers();
  }

  @Get('vehicles')
  listVehicles() {
    return this.ctDispatcherService.listVehicles();
  }

  @Post('assignments')
  assignDriver(@Body() payload: AssignDriverDto) {
    return this.ctDispatcherService.assignDriver(payload);
  }

  @Get('vehicles/:fleetNumber/monitoring')
  monitorVehicle(@Param('fleetNumber') fleetNumber: string) {
    return this.ctDispatcherService.monitorVehicle(fleetNumber);
  }

  @Post('vehicles/:fleetNumber/deviation')
  detectDeviation(
    @Param('fleetNumber') fleetNumber: string,
    @Body() payload: DetectDeviationDto,
  ) {
    return this.ctDispatcherService.detectDeviation(fleetNumber, payload);
  }
}
