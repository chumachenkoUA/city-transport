import { BadRequestException, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { CreateDriverDto } from '../../modules/drivers/dto/create-driver.dto';
import { CreateManagerVehicleDto } from './dto/create-manager-vehicle.dto';

type ManagerDriverRow = {
  id: number;
  login: string;
  fullName: string;
  email: string;
  phone: string;
  driverLicenseNumber: string;
  licenseCategories: unknown;
  passportData: unknown;
};

type ManagerVehicleRow = {
  id: number;
  fleetNumber: string;
  capacity: number;
  transportTypeId: number;
  transportType: string;
  routeId: number;
  routeNumber: string;
  direction: string;
};

type ManagerRouteRow = {
  id: number;
  number: string;
  direction: string;
  transportTypeId: number;
  transportType: string;
};

type ManagerTransportTypeRow = {
  id: number;
  name: string;
};

@Injectable()
export class CtManagerService {
  constructor(private readonly dbService: DbService) {}

  async listDrivers() {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        login as "login",
        full_name as "fullName",
        email as "email",
        phone as "phone",
        driver_license_number as "driverLicenseNumber",
        license_categories as "licenseCategories",
        passport_data as "passportData"
      from manager_api.v_drivers
      order by id desc
    `)) as unknown as { rows: ManagerDriverRow[] };

    return result.rows;
  }

  async listVehicles() {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        fleet_number as "fleetNumber",
        capacity as "capacity",
        transport_type_id as "transportTypeId",
        transport_type as "transportType",
        route_id as "routeId",
        route_number as "routeNumber",
        direction as "direction"
      from manager_api.v_vehicles
      order by id desc
    `)) as unknown as { rows: ManagerVehicleRow[] };

    return result.rows;
  }

  async listRoutes() {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        number as "number",
        direction as "direction",
        transport_type_id as "transportTypeId",
        transport_type as "transportType"
      from manager_api.v_routes
      order by number
    `)) as unknown as { rows: ManagerRouteRow[] };

    return result.rows;
  }

  async listTransportTypes() {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        name as "name"
      from manager_api.v_transport_types
      order by id
    `)) as unknown as { rows: ManagerTransportTypeRow[] };

    return result.rows;
  }

  async hireDriver(payload: CreateDriverDto) {
    const result = (await this.dbService.db.execute(sql`
      select manager_api.create_driver(
        ${payload.login},
        ${payload.fullName},
        ${payload.email},
        ${payload.phone},
        ${payload.driverLicenseNumber},
        ${JSON.stringify(payload.passportData)},
        ${JSON.stringify(payload.licenseCategories)}
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0]?.id };
  }

  async addVehicle(payload: CreateManagerVehicleDto) {
    if (!payload.routeId && !payload.routeNumber) {
      throw new BadRequestException('routeId or routeNumber is required');
    }

    const result = (await this.dbService.db.execute(sql`
      select manager_api.create_vehicle(
        ${payload.fleetNumber},
        ${payload.transportTypeId},
        ${payload.capacity},
        ${payload.routeId ?? null},
        ${payload.routeNumber ?? null},
        ${payload.direction ?? 'forward'}
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0]?.id };
  }
}
