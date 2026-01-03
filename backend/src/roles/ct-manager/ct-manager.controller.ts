import { Body, Controller, Get, Post } from '@nestjs/common';
import { CreateDriverDto } from '../../modules/drivers/dto/create-driver.dto';
import { CtManagerService } from './ct-manager.service';
import { CreateManagerVehicleDto } from './dto/create-manager-vehicle.dto';

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

  @Post('drivers')
  hireDriver(@Body() payload: CreateDriverDto) {
    return this.ctManagerService.hireDriver(payload);
  }

  @Post('vehicles')
  addVehicle(@Body() payload: CreateManagerVehicleDto) {
    return this.ctManagerService.addVehicle(payload);
  }
}
