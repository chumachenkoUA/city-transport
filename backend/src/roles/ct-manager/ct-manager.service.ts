import { Injectable } from '@nestjs/common';
import { CreateDriverDto } from '../../modules/drivers/dto/create-driver.dto';
import { DriversService } from '../../modules/drivers/drivers.service';
import { CreateVehicleDto } from '../../modules/vehicles/dto/create-vehicle.dto';
import { VehiclesService } from '../../modules/vehicles/vehicles.service';

@Injectable()
export class CtManagerService {
  constructor(
    private readonly driversService: DriversService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  hireDriver(payload: CreateDriverDto) {
    return this.driversService.create(payload);
  }

  addVehicle(payload: CreateVehicleDto) {
    return this.vehiclesService.create(payload);
  }
}
