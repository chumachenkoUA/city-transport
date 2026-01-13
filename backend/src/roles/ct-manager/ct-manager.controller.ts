import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CreateDriverDto } from '../../modules/drivers/dto/create-driver.dto';
import { CtManagerService } from './ct-manager.service';
import { CreateManagerVehicleDto } from './dto/create-manager-vehicle.dto';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';

@Controller('manager')
export class CtManagerController {
  constructor(private readonly ctManagerService: CtManagerService) {}

  @Get('drivers')
  listDrivers() {
    return this.ctManagerService.listDrivers();
  }

  @Get('vehicles')
  listVehicles() {
    return this.ctManagerService.listVehicles();
  }

  @Get('routes')
  listRoutes() {
    return this.ctManagerService.listRoutes();
  }

  @Get('transport-types')
  listTransportTypes() {
    return this.ctManagerService.listTransportTypes();
  }

  @Get('models')
  listModels() {
    return this.ctManagerService.listModels();
  }

  @Post('drivers')
  hireDriver(@Body() payload: CreateDriverDto) {
    return this.ctManagerService.hireDriver(payload);
  }

  @Post('vehicles')
  addVehicle(@Body() payload: CreateManagerVehicleDto) {
    return this.ctManagerService.addVehicle(payload);
  }

  @Get('staff-roles')
  listStaffRoles() {
    return this.ctManagerService.listStaffRoles();
  }

  @Post('staff')
  createStaffUser(@Body() payload: CreateStaffUserDto) {
    return this.ctManagerService.createStaffUser(payload);
  }

  @Delete('staff/:login')
  removeStaffUser(@Param('login') login: string) {
    return this.ctManagerService.removeStaffUser(login);
  }
}
