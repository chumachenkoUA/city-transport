import { BadRequestException, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { CreateDriverDto } from '../../modules/drivers/dto/create-driver.dto';
import { CreateManagerVehicleDto } from './dto/create-manager-vehicle.dto';
import { CreateStaffUserDto } from './dto/create-staff-user.dto';

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
        id,
        login,
        full_name,
        email,
        phone,
        driver_license_number,
        license_categories
      from manager_api.v_drivers
      order by id desc
    `)) as unknown as { rows: ManagerDriverRow[] };

    return result.rows;
  }

  async listVehicles() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        fleet_number,
        route_number,
        transport_type,
        model_name,
        capacity
      from manager_api.v_vehicles
      order by id desc
    `)) as unknown as { rows: ManagerVehicleRow[] };

    return result.rows;
  }

  async listRoutes() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        number,
        direction,
        transport_type_id,
        transport_type_name
      from guest_api.v_routes
      order by number
    `)) as unknown as { rows: Record<string, unknown>[] };

    return result.rows;
  }

  async listTransportTypes() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        name
      from guest_api.v_transport_types
      order by id
    `)) as unknown as { rows: Record<string, unknown>[] };

    return result.rows;
  }

  async listModels() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        name,
        capacity,
        type_id,
        transport_type
      from manager_api.v_vehicle_models
      order by name
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
    if (!payload.routeId && !payload.routeNumber) {
      throw new BadRequestException('routeId or routeNumber is required');
    }

    const result = (await this.dbService.db.execute(sql`
      select manager_api.add_vehicle_v2(
        ${payload.fleetNumber},
        ${payload.modelId},
        ${payload.routeId ?? null},
        ${payload.routeNumber ?? null}
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0]?.id };
  }

  async createStaffUser(payload: CreateStaffUserDto) {
    await this.dbService.db.execute(sql`
      SELECT manager_api.create_staff_user(
        ${payload.login},
        ${payload.password},
        ${payload.role},
        ${payload.fullName ?? null},
        ${payload.email ?? null},
        ${payload.phone ?? null}
      )
    `);
    return { ok: true };
  }

  async removeStaffUser(login: string) {
    await this.dbService.db.execute(sql`
      SELECT manager_api.remove_staff_user(${login})
    `);
    return { ok: true };
  }

  async listStaffRoles() {
    const result = (await this.dbService.db.execute(sql`
      SELECT role_name, description
      FROM manager_api.v_staff_roles
    `)) as unknown as {
      rows: Array<{ role_name: string; description: string }>;
    };

    return result.rows;
  }
}
