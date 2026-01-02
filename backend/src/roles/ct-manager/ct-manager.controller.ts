import { Body, Controller, Post } from '@nestjs/common';
import { CreateDriverDto } from '../../modules/drivers/dto/create-driver.dto';
import { CreateVehicleDto } from '../../modules/vehicles/dto/create-vehicle.dto';
import { CtManagerService } from './ct-manager.service';

@Controller('manager')
export class CtManagerController {
  constructor(private readonly ctManagerService: CtManagerService) {}

  @Post('drivers')
  hireDriver(@Body() payload: CreateDriverDto) {
    return this.ctManagerService.hireDriver(payload);
  }

  @Post('vehicles')
  addVehicle(@Body() payload: CreateVehicleDto) {
    return this.ctManagerService.addVehicle(payload);
  }
}
