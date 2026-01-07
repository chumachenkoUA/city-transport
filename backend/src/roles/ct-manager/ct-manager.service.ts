import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
};

type ManagerVehicleRow = {
  id: number;
  fleetNumber: string;
  routeNumber: string;
  transportType: string;
  modelName: string;
  capacity: number;
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
        license_categories as "licenseCategories"
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
        route_number as "routeNumber",
        transport_type as "transportType",
        model_name as "modelName",
        capacity as "capacity"
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
        transport_type_name as "transportType"
      from guest_api.v_routes
      order by number
    `)) as unknown as { rows: Record<string, unknown>[] };

    return result.rows;
  }

  async listTransportTypes() {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        name as "name"
      from guest_api.v_transport_types
      order by id
    `)) as unknown as { rows: Record<string, unknown>[] };

    return result.rows;
  }

  async hireDriver(payload: CreateDriverDto) {
    const password = payload.password || 'driver123';

    const result = (await this.dbService.db.execute(sql`
      select manager_api.hire_driver(
        ${payload.login},
        ${password},
        ${payload.email},
        ${payload.phone},
        ${payload.fullName},
        ${payload.driverLicenseNumber},
        ${JSON.stringify(payload.licenseCategories)}::jsonb,
        ${JSON.stringify(payload.passportData)}::jsonb
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0]?.id };
  }

  async addVehicle(payload: CreateManagerVehicleDto) {
    const ttResult = (await this.dbService.db.execute(sql`
       select name from public.transport_types where id = ${payload.transportTypeId}
    `)) as unknown as { rows: { name: string }[] };

    const ttName = ttResult.rows[0]?.name;
    if (!ttName)
      throw new NotFoundException(
        `Transport Type ${payload.transportTypeId} not found`,
      );

    let routeNumber = payload.routeNumber;
    if (!routeNumber && payload.routeId) {
      const rResult = (await this.dbService.db.execute(sql`
            select number from public.routes where id = ${payload.routeId}
         `)) as unknown as { rows: { number: string }[] };
      routeNumber = rResult.rows[0]?.number;
    }

    if (!routeNumber) {
      throw new BadRequestException('routeNumber or valid routeId is required');
    }

    const modelName = 'Default Model';

    const result = (await this.dbService.db.execute(sql`
      select manager_api.add_vehicle(
        ${payload.fleetNumber},
        ${ttName},
        ${routeNumber},
        ${payload.capacity},
        ${modelName}
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0]?.id };
  }
}
