import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CtAdminService } from './ct-admin.service';
import { CreateDriverDto } from '../../modules/drivers/dto/create-driver.dto';
import { UpdateDriverDto } from '../../modules/drivers/dto/update-driver.dto';
import { CreateRouteDto } from '../../modules/routes/dto/create-route.dto';
import { UpdateRouteDto } from '../../modules/routes/dto/update-route.dto';
import { CreateStopDto } from '../../modules/stops/dto/create-stop.dto';
import { UpdateStopDto } from '../../modules/stops/dto/update-stop.dto';
import { CreateTransportTypeDto } from '../../modules/transport-types/dto/create-transport-type.dto';
import { UpdateTransportTypeDto } from '../../modules/transport-types/dto/update-transport-type.dto';
import { CreateUserDto } from '../../modules/users/dto/create-user.dto';
import { UpdateUserDto } from '../../modules/users/dto/update-user.dto';
import { CreateVehicleDto } from '../../modules/vehicles/dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../../modules/vehicles/dto/update-vehicle.dto';

@Controller('admin')
export class CtAdminController {
  constructor(private readonly ctAdminService: CtAdminService) {}

  @Get('summary')
  getSummary() {
    return this.ctAdminService.getSummary();
  }

  @Post('users')
  createUser(@Body() payload: CreateUserDto) {
    return this.ctAdminService.createUser(payload);
  }

  @Patch('users/:id')
  updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateUserDto,
  ) {
    return this.ctAdminService.updateUser(id, payload);
  }

  @Delete('users/:id')
  removeUser(@Param('id', ParseIntPipe) id: number) {
    return this.ctAdminService.removeUser(id);
  }

  @Post('drivers')
  createDriver(@Body() payload: CreateDriverDto) {
    return this.ctAdminService.createDriver(payload);
  }

  @Patch('drivers/:id')
  updateDriver(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateDriverDto,
  ) {
    return this.ctAdminService.updateDriver(id, payload);
  }

  @Delete('drivers/:id')
  removeDriver(@Param('id', ParseIntPipe) id: number) {
    return this.ctAdminService.removeDriver(id);
  }

  @Post('stops')
  createStop(@Body() payload: CreateStopDto) {
    return this.ctAdminService.createStop(payload);
  }

  @Patch('stops/:id')
  updateStop(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateStopDto,
  ) {
    return this.ctAdminService.updateStop(id, payload);
  }

  @Delete('stops/:id')
  removeStop(@Param('id', ParseIntPipe) id: number) {
    return this.ctAdminService.removeStop(id);
  }

  @Post('transport-types')
  createTransportType(@Body() payload: CreateTransportTypeDto) {
    return this.ctAdminService.createTransportType(payload);
  }

  @Patch('transport-types/:id')
  updateTransportType(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateTransportTypeDto,
  ) {
    return this.ctAdminService.updateTransportType(id, payload);
  }

  @Delete('transport-types/:id')
  removeTransportType(@Param('id', ParseIntPipe) id: number) {
    return this.ctAdminService.removeTransportType(id);
  }

  @Post('routes')
  createRoute(@Body() payload: CreateRouteDto) {
    return this.ctAdminService.createRoute(payload);
  }

  @Patch('routes/:id')
  updateRoute(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateRouteDto,
  ) {
    return this.ctAdminService.updateRoute(id, payload);
  }

  @Delete('routes/:id')
  removeRoute(@Param('id', ParseIntPipe) id: number) {
    return this.ctAdminService.removeRoute(id);
  }

  @Post('vehicles')
  createVehicle(@Body() payload: CreateVehicleDto) {
    return this.ctAdminService.createVehicle(payload);
  }

  @Patch('vehicles/:id')
  updateVehicle(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateVehicleDto,
  ) {
    return this.ctAdminService.updateVehicle(id, payload);
  }

  @Delete('vehicles/:id')
  removeVehicle(@Param('id', ParseIntPipe) id: number) {
    return this.ctAdminService.removeVehicle(id);
  }
}
