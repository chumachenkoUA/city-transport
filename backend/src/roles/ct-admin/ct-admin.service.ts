import { Injectable } from '@nestjs/common';
import { DriversService } from '../../modules/drivers/drivers.service';
import { CreateDriverDto } from '../../modules/drivers/dto/create-driver.dto';
import { UpdateDriverDto } from '../../modules/drivers/dto/update-driver.dto';
import { RoutesService } from '../../modules/routes/routes.service';
import { CreateRouteDto } from '../../modules/routes/dto/create-route.dto';
import { UpdateRouteDto } from '../../modules/routes/dto/update-route.dto';
import { StopsService } from '../../modules/stops/stops.service';
import { CreateStopDto } from '../../modules/stops/dto/create-stop.dto';
import { UpdateStopDto } from '../../modules/stops/dto/update-stop.dto';
import { TransportTypesService } from '../../modules/transport-types/transport-types.service';
import { CreateTransportTypeDto } from '../../modules/transport-types/dto/create-transport-type.dto';
import { UpdateTransportTypeDto } from '../../modules/transport-types/dto/update-transport-type.dto';
import { UsersService } from '../../modules/users/users.service';
import { CreateUserDto } from '../../modules/users/dto/create-user.dto';
import { UpdateUserDto } from '../../modules/users/dto/update-user.dto';
import { VehiclesService } from '../../modules/vehicles/vehicles.service';
import { CreateVehicleDto } from '../../modules/vehicles/dto/create-vehicle.dto';
import { UpdateVehicleDto } from '../../modules/vehicles/dto/update-vehicle.dto';

@Injectable()
export class CtAdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly driversService: DriversService,
    private readonly stopsService: StopsService,
    private readonly transportTypesService: TransportTypesService,
    private readonly routesService: RoutesService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  async getSummary() {
    const [users, drivers, stops, routes, vehicles] = await Promise.all([
      this.usersService.findAll(),
      this.driversService.findAll(),
      this.stopsService.findAll(),
      this.routesService.findAll(),
      this.vehiclesService.findAll(),
    ]);

    return {
      users: users.length,
      drivers: drivers.length,
      stops: stops.length,
      routes: routes.length,
      vehicles: vehicles.length,
    };
  }

  createUser(payload: CreateUserDto) {
    return this.usersService.create(payload);
  }

  updateUser(id: number, payload: UpdateUserDto) {
    return this.usersService.update(id, payload);
  }

  removeUser(id: number) {
    return this.usersService.remove(id);
  }

  createDriver(payload: CreateDriverDto) {
    return this.driversService.create(payload);
  }

  updateDriver(id: number, payload: UpdateDriverDto) {
    return this.driversService.update(id, payload);
  }

  removeDriver(id: number) {
    return this.driversService.remove(id);
  }

  createStop(payload: CreateStopDto) {
    return this.stopsService.create(payload);
  }

  updateStop(id: number, payload: UpdateStopDto) {
    return this.stopsService.update(id, payload);
  }

  removeStop(id: number) {
    return this.stopsService.remove(id);
  }

  createTransportType(payload: CreateTransportTypeDto) {
    return this.transportTypesService.create(payload);
  }

  updateTransportType(id: number, payload: UpdateTransportTypeDto) {
    return this.transportTypesService.update(id, payload);
  }

  removeTransportType(id: number) {
    return this.transportTypesService.remove(id);
  }

  createRoute(payload: CreateRouteDto) {
    return this.routesService.create(payload);
  }

  updateRoute(id: number, payload: UpdateRouteDto) {
    return this.routesService.update(id, payload);
  }

  removeRoute(id: number) {
    return this.routesService.remove(id);
  }

  createVehicle(payload: CreateVehicleDto) {
    return this.vehiclesService.create(payload);
  }

  updateVehicle(id: number, payload: UpdateVehicleDto) {
    return this.vehiclesService.update(id, payload);
  }

  removeVehicle(id: number) {
    return this.vehiclesService.remove(id);
  }
}
