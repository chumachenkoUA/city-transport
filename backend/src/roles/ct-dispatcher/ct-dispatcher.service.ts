import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { CreateDispatcherScheduleDto } from './dto/create-schedule.dto';
import { DetectDeviationDto } from './dto/deviation.dto';
import { UpdateDispatcherScheduleDto } from './dto/update-schedule.dto';

type MonitoringRow = {
  fleetNumber: string;
  routeNumber: string;
  transportType: string;
  lon: string;
  lat: string;
  lastRecordedAt: string;
  status: string;
  driverName: string;
};

type StopRow = {
  stopId: number;
  stopName: string;
  distanceToNextKm: string | null;
  lon: string;
  lat: string;
};

@Injectable()
export class CtDispatcherService {
  constructor(private readonly dbService: DbService) {}

  async createSchedule(payload: CreateDispatcherScheduleDto) {
    let transportTypeName = '';

    // Якщо передано ID типу транспорту, знаходимо його назву
    if (payload.transportTypeId) {
      const tt = await this.findTransportTypeById(payload.transportTypeId);
      transportTypeName = tt.name;
    }
    // Якщо передано маршрут, але не тип транспорту, спробуємо знайти через маршрут (якщо routeId є)
    else if (payload.routeId) {
      const route = await this.findRouteById(payload.routeId);
      const tt = await this.findTransportTypeById(route.transportTypeId);
      transportTypeName = tt.name;
    }

    if (!transportTypeName) {
      throw new BadRequestException('Transport Type ID is required');
    }

    const routeNumber =
      payload.routeNumber ??
      (payload.routeId
        ? (await this.findRouteById(payload.routeId)).number
        : null);

    if (!routeNumber) {
      throw new BadRequestException('Route Number or Route ID is required');
    }

    const result = (await this.dbService.db.execute(sql`
      select dispatcher_api.create_schedule_v2(
        ${routeNumber},
        ${transportTypeName},
        ${payload.workStartTime}::time,
        ${payload.workEndTime}::time,
        ${payload.intervalMin}
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0].id };
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
      order by number, direction
    `)) as unknown as {
      rows: Array<{
        id: number;
        number: string;
        direction: string;
        transportTypeId: number;
        transportType: string;
      }>;
    };

    return result.rows;
  }

  async listSchedules() {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        route_number as "routeNumber",
        transport_type as "transportType",
        work_start_time as "workStartTime",
        work_end_time as "workEndTime",
        interval_min as "intervalMin"
      from dispatcher_api.v_schedules_list
      order by route_number
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeNumber: string;
        transportType: string;
        workStartTime: string;
        workEndTime: string;
        intervalMin: number;
      }>;
    };

    return result.rows;
  }

  async listVehicles() {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        fleet_number as "fleetNumber",
        route_id as "routeId",
        route_number as "routeNumber",
        capacity as "capacity"
      from dispatcher_api.v_vehicles_list
      order by fleet_number
    `)) as unknown as {
      rows: Array<{
        id: number;
        fleetNumber: string;
        routeId: number;
        routeNumber: string;
        capacity: number;
      }>;
    };

    return result.rows;
  }

  async listDrivers() {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        login as "login",
        full_name as "fullName",
        phone as "phone",
        driver_license_number as "driverLicenseNumber"
      from dispatcher_api.v_drivers_list
      order by full_name
    `)) as unknown as {
      rows: Array<{
        id: number;
        login: string;
        fullName: string;
        phone: string;
        driverLicenseNumber: string;
      }>;
    };

    return result.rows;
  }

  async listAssignments() {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        driver_id as "driverId",
        driver_name as "driverName",
        driver_login as "driverLogin",
        driver_phone as "driverPhone",
        vehicle_id as "vehicleId",
        fleet_number as "fleetNumber",
        route_id as "routeId",
        route_number as "routeNumber",
        direction as "direction",
        transport_type_id as "transportTypeId",
        transport_type as "transportType",
        assigned_at as "assignedAt"
      from dispatcher_api.v_assignments_history
      order by assigned_at desc
    `)) as unknown as {
      rows: Array<{
        id: number;
        driverId: number;
        driverName: string;
        driverLogin: string;
        driverPhone: string;
        vehicleId: number;
        fleetNumber: string;
        routeId: number;
        routeNumber: string;
        direction: string;
        transportTypeId: number;
        transportType: string;
        assignedAt: Date;
      }>;
    };

    return result.rows;
  }

  async listActiveTrips() {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        route_number as "routeNumber",
        fleet_number as "fleetNumber",
        full_name as "driverName",
        starts_at as "startsAt"
      from dispatcher_api.v_active_trips
      order by starts_at desc
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeNumber: string;
        fleetNumber: string;
        driverName: string;
        startsAt: Date;
      }>;
    };

    return result.rows;
  }

  async listDeviations() {
    const result = (await this.dbService.db.execute(sql`
        select
            fleet_number as "fleetNumber",
            route_number as "routeNumber",
            transport_type as "transportType",
            last_recorded_at as "lastRecordedAt",
            status as "status",
            current_driver_name as "driverName"
        from dispatcher_api.v_vehicle_monitoring
        where status = 'active'
      `)) as unknown as { rows: MonitoringRow[] };

    return result.rows;
  }

  async getDashboard() {
    const [activeTrips, schedules, drivers, vehicles, assignments, deviations] =
      await Promise.all([
        this.listActiveTrips(),
        this.listSchedules(),
        this.listDrivers(),
        this.listVehicles(),
        this.listAssignments(),
        this.listDeviations(),
      ]);

    const assignedDrivers = new Set(assignments.map((row) => row.driverId));
    const assignedVehicles = new Set(assignments.map((row) => row.vehicleId));
    const unassignedDrivers = drivers.filter(
      (driver) => !assignedDrivers.has(driver.id),
    ).length;
    const unassignedVehicles = vehicles.filter(
      (vehicle) => !assignedVehicles.has(vehicle.id),
    ).length;

    const deviationCount = deviations.length;

    return {
      activeTrips: activeTrips.length,
      deviations: deviationCount,
      schedulesToday: schedules.length,
      unassignedDrivers,
      unassignedVehicles,
    };
  }

  async getRoutePoints(routeId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        route_id as "routeId",
        lon as "lon",
        lat as "lat"
      from guest_api.v_route_points
      where route_id = ${routeId}
      order by id
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeId: number;
        lon: string;
        lat: string;
      }>;
    };

    return result.rows;
  }

  async updateSchedule(id: number, payload: UpdateDispatcherScheduleDto) {
    await this.dbService.db.execute(sql`
      select dispatcher_api.update_schedule(
        ${id},
        ${payload.workStartTime ?? null}::time,
        ${payload.workEndTime ?? null}::time,
        ${payload.intervalMin ?? null}::integer
      )
    `);

    return { ok: true };
  }

  async getScheduleDetails(id: number) {
    const schedule = await this.findScheduleById(id);

    const stopsResult = (await this.dbService.db.execute(sql`
      select
        stop_id as "stopId",
        stop_name as "stopName",
        distance_to_next_km as "distanceToNextKm",
        lon as "lon",
        lat as "lat"
      from guest_api.v_route_stops
      where route_id = ${schedule.routeId}
      order by id
    `)) as unknown as { rows: StopRow[] };

    const stopsWithIntervals = stopsResult.rows.map((stop) => {
      const distanceKm = stop.distanceToNextKm
        ? Number(stop.distanceToNextKm)
        : null;
      const minutesToNextStop =
        distanceKm !== null ? this.roundTo1((distanceKm / 25) * 60) : null;

      return {
        id: stop.stopId,
        name: stop.stopName,
        lon: stop.lon,
        lat: stop.lat,
        distanceToNextKm: distanceKm,
        minutesToNextStop,
      };
    });

    return {
      id: schedule.id,
      routeNumber: schedule.routeNumber,
      transportType: schedule.transportType,
      workStartTime: schedule.workStartTime,
      workEndTime: schedule.workEndTime,
      intervalMin: schedule.intervalMin,
      stops: stopsWithIntervals,
    };
  }

  async assignDriver(payload: AssignDriverDto) {
    const driverId = await this.resolveDriverId(payload);
    const fleetNumber = await this.resolveFleetNumber(payload);

    await this.dbService.db.execute(sql`
      select dispatcher_api.assign_driver_v2(
        ${driverId},
        ${fleetNumber}
      )
    `);

    return { ok: true };
  }

  async monitorVehicle(fleetNumber: string) {
    const result = (await this.dbService.db.execute(sql`
      select 
         fleet_number as "fleetNumber",
         route_number as "routeNumber",
         transport_type as "transportType",
         last_lon as "lon",
         last_lat as "lat",
         last_recorded_at as "recordedAt",
         status as "status",
         current_driver_name as "driverName"
      from dispatcher_api.v_vehicle_monitoring
      where fleet_number = ${fleetNumber}
      limit 1
    `)) as unknown as { rows: MonitoringRow[] };

    const monitoring = result.rows[0];
    if (!monitoring) {
      throw new NotFoundException(
        `Vehicle ${fleetNumber} not found in monitoring`,
      );
    }

    const routeResult = (await this.dbService.db.execute(sql`
       select r.id as "id" from public.routes r 
       join public.transport_types tt on tt.id = r.transport_type_id
       where r.number = ${monitoring.routeNumber} and tt.name = ${monitoring.transportType}
       limit 1
    `)) as unknown as { rows: { id: number }[] };

    let points: { id: number; routeId: number; lon: string; lat: string }[] =
      [];
    if (routeResult.rows[0]) {
      points = await this.getRoutePoints(routeResult.rows[0].id);
    }

    return {
      vehicle: {
        ...monitoring,
        recordedAt: monitoring.lastRecordedAt,
      },
      routePoints: points,
    };
  }

  async detectDeviation(fleetNumber: string, payload: DetectDeviationDto) {
    const status = await this.monitorVehicle(fleetNumber);

    const isLate =
      status.vehicle.status === 'active' &&
      (!payload.currentTime ||
        new Date(status.vehicle.lastRecordedAt).getTime() <
          new Date().getTime() - 5 * 60000);

    return {
      fleetNumber,
      status: status.vehicle.status,
      deviation: isLate ? 'Possible delay (no GPS update)' : 'OK',
      details: status.vehicle,
    };
  }

  // --- Helpers ---

  private async findTransportTypeById(id: number) {
    const result = (await this.dbService.db.execute(sql`
        select id, name from public.transport_types where id = ${id}
      `)) as unknown as { rows: { id: number; name: string }[] };
    return result.rows[0];
  }

  private async findRouteById(routeId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        number as "number",
        transport_type_id as "transportTypeId",
        direction as "direction"
      from guest_api.v_routes
      where id = ${routeId}
      limit 1
    `)) as unknown as {
      rows: Array<{
        id: number;
        number: string;
        transportTypeId: number;
        direction: string;
      }>;
    };

    const route = result.rows[0];
    if (!route) {
      throw new NotFoundException(`Route ${routeId} not found`);
    }

    return route;
  }

  private async findScheduleById(id: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        route_number as "routeNumber",
        transport_type as "transportType",
        work_start_time as "workStartTime",
        work_end_time as "workEndTime",
        interval_min as "intervalMin"
      from dispatcher_api.v_schedules_list
      where id = ${id}
      limit 1
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeNumber: string;
        transportType: string;
        workStartTime: string;
        workEndTime: string;
        intervalMin: number;
      }>;
    };

    const schedule = result.rows[0];
    if (!schedule) {
      throw new NotFoundException(`Schedule ${id} not found`);
    }

    const route = await this.findRouteByNumberAndType(
      schedule.routeNumber,
      schedule.transportType,
    );

    return {
      id: schedule.id,
      routeId: route.id,
      routeNumber: schedule.routeNumber,
      transportType: schedule.transportType,
      workStartTime: schedule.workStartTime,
      workEndTime: schedule.workEndTime,
      intervalMin: schedule.intervalMin,
    };
  }

  private async findRouteByNumberAndType(
    routeNumber: string,
    transportType: string,
  ) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        number as "number",
        transport_type_id as "transportTypeId",
        direction as "direction"
      from guest_api.v_routes
      where number = ${routeNumber}
        and transport_type_name = ${transportType}
      limit 1
    `)) as unknown as {
      rows: Array<{
        id: number;
        number: string;
        transportTypeId: number;
        direction: string;
      }>;
    };

    const route = result.rows[0];
    if (!route) {
      throw new NotFoundException(
        `Route ${routeNumber} (${transportType}) not found`,
      );
    }

    return route;
  }

  private async resolveDriverId(payload: {
    driverId?: number;
    driverLogin?: string;
  }) {
    if (payload.driverId) {
      return payload.driverId;
    }

    if (!payload.driverLogin) {
      throw new BadRequestException('driverId or driverLogin is required');
    }

    const result = (await this.dbService.db.execute(sql`
      select id
      from dispatcher_api.v_drivers_list
      where login = ${payload.driverLogin}
      limit 1
    `)) as unknown as { rows: Array<{ id: number }> };

    const driver = result.rows[0];
    if (!driver) {
      throw new NotFoundException(`Driver ${payload.driverLogin} not found`);
    }

    return driver.id;
  }

  private async resolveFleetNumber(payload: {
    vehicleId?: number;
    fleetNumber?: string;
  }) {
    if (payload.fleetNumber) return payload.fleetNumber;
    if (payload.vehicleId) {
      const result = (await this.dbService.db.execute(sql`
             select fleet_number as "fleetNumber" from dispatcher_api.v_vehicles_list where id = ${payload.vehicleId}
          `)) as unknown as { rows: { fleetNumber: string }[] };
      if (result.rows[0]) return result.rows[0].fleetNumber;
    }
    throw new BadRequestException('Fleet Number required');
  }

  private roundTo1(value: number) {
    return Math.round(value * 10) / 10;
  }
}
