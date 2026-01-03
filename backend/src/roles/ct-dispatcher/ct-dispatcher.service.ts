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

const AVERAGE_SPEED_KMH = 25;

@Injectable()
export class CtDispatcherService {
  constructor(private readonly dbService: DbService) {}

  async createSchedule(payload: CreateDispatcherScheduleDto) {
    const routeId = await this.resolveRouteId(payload);

    if (payload.fleetNumber) {
      const vehicle = await this.findVehicleByFleet(payload.fleetNumber);

      if (!vehicle) {
        throw new NotFoundException(`Vehicle ${payload.fleetNumber} not found`);
      }

      if (vehicle.routeId !== routeId) {
        throw new BadRequestException(
          `Vehicle ${payload.fleetNumber} is not assigned to route ${routeId}`,
        );
      }
    }

    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        route_id as "routeId",
        work_start_time as "workStartTime",
        work_end_time as "workEndTime",
        interval_min as "intervalMin"
      from dispatcher_api.create_schedule(
        ${routeId},
        ${payload.workStartTime}::time,
        ${payload.workEndTime}::time,
        ${payload.intervalMin}
      )
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeId: number;
        workStartTime: string;
        workEndTime: string;
        intervalMin: number;
      }>;
    };

    return result.rows[0] ?? null;
  }

  async listRoutes() {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        number as "number",
        direction as "direction",
        transport_type_id as "transportTypeId",
        transport_type as "transportType"
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
        sc.id as "id",
        sc.route_id as "routeId",
        sc.work_start_time as "workStartTime",
        sc.work_end_time as "workEndTime",
        sc.interval_min as "intervalMin",
        r.number as "routeNumber",
        r.direction as "direction",
        r.transport_type_id as "transportTypeId",
        r.transport_type as "transportType"
      from guest_api.v_schedules sc
      join guest_api.v_routes r on r.id = sc.route_id
      order by r.number, r.direction
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeId: number;
        workStartTime: string;
        workEndTime: string;
        intervalMin: number;
        routeNumber: string;
        direction: string;
        transportTypeId: number;
        transportType: string;
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
        transport_type_id as "transportTypeId",
        capacity as "capacity"
      from dispatcher_api.v_vehicles
      order by fleet_number
    `)) as unknown as {
      rows: Array<{
        id: number;
        fleetNumber: string;
        routeId: number;
        transportTypeId: number;
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
        email as "email"
      from dispatcher_api.v_drivers
      order by full_name
    `)) as unknown as {
      rows: Array<{
        id: number;
        login: string;
        fullName: string;
        phone: string;
        email: string;
      }>;
    };

    return result.rows;
  }

  async updateSchedule(id: number, payload: UpdateDispatcherScheduleDto) {
    const routeId =
      payload.routeId !== undefined
        ? payload.routeId
        : payload.routeNumber || payload.transportTypeId
          ? await this.resolveRouteId(payload)
          : null;

    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        route_id as "routeId",
        work_start_time as "workStartTime",
        work_end_time as "workEndTime",
        interval_min as "intervalMin"
      from dispatcher_api.update_schedule(
        ${id},
        ${routeId}::bigint,
        ${payload.workStartTime ?? null}::time,
        ${payload.workEndTime ?? null}::time,
        ${payload.intervalMin ?? null}::integer
      )
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeId: number;
        workStartTime: string;
        workEndTime: string;
        intervalMin: number;
      }>;
    };

    return result.rows[0] ?? null;
  }

  async getScheduleDetails(id: number) {
    const schedule = await this.findScheduleById(id);
    const route = await this.findRouteById(schedule.routeId);
    const vehicles = await this.findVehiclesByRouteId(route.id);
    const stops = await this.findStopsByRouteId(route.id);

    const stopsWithIntervals = stops.map((stop) => {
      const distanceKm = stop.distanceToNextKm
        ? Number(stop.distanceToNextKm)
        : null;
        const minutesToNextStop =
          distanceKm !== null
            ? this.roundTo1((distanceKm / AVERAGE_SPEED_KMH) * 60)
            : null;

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
      route: {
        id: route.id,
        number: route.number,
        transportTypeId: route.transportTypeId,
        direction: route.direction,
      },
      vehicles: vehicles.map((vehicle) => ({
        id: vehicle.id,
        fleetNumber: vehicle.fleetNumber,
      })),
      workStartTime: schedule.workStartTime,
      workEndTime: schedule.workEndTime,
      intervalMin: schedule.intervalMin,
      stops: stopsWithIntervals,
    };
  }

  async assignDriver(payload: AssignDriverDto) {
    await this.findDriverById(payload.driverId);
    const vehicle = await this.resolveVehicle(payload);

    if (payload.routeNumber || payload.transportTypeId) {
      const routeId = await this.resolveRouteId(payload);
      if (vehicle.routeId !== routeId) {
        throw new BadRequestException(
          `Vehicle ${vehicle.fleetNumber} is not assigned to route ${routeId}`,
        );
      }
    }

    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        driver_id as "driverId",
        vehicle_id as "vehicleId",
        assigned_at as "assignedAt"
      from dispatcher_api.assign_driver(
        ${payload.driverId},
        ${vehicle.id},
        ${payload.assignedAt ?? null}::timestamp
      )
    `)) as unknown as {
      rows: Array<{
        id: number;
        driverId: number;
        vehicleId: number;
        assignedAt: Date;
      }>;
    };

    return result.rows[0] ?? null;
  }

  async monitorVehicle(fleetNumber: string) {
    const vehicle = await this.findVehicleByFleet(fleetNumber);

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${fleetNumber} not found`);
    }

    const route = await this.findRouteById(vehicle.routeId);
    const routePoints = await this.findRoutePointsByRouteId(route.id);
    const currentPosition = await this.findLatestVehicleGps(vehicle.id);

    return {
      vehicle: {
        id: vehicle.id,
        fleetNumber: vehicle.fleetNumber,
        routeId: vehicle.routeId,
      },
      route: {
        id: route.id,
        number: route.number,
        transportTypeId: route.transportTypeId,
        direction: route.direction,
      },
      routePoints: routePoints.map((point) => ({
        id: point.id,
        lon: point.lon,
        lat: point.lat,
      })),
      currentPosition: currentPosition
        ? {
          lon: currentPosition.lon,
          lat: currentPosition.lat,
          recordedAt: currentPosition.recordedAt,
        }
        : null,
    };
  }

  async detectDeviation(fleetNumber: string, payload: DetectDeviationDto) {
    const vehicle = await this.findVehicleByFleet(fleetNumber);

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${fleetNumber} not found`);
    }

    const schedule = await this.findScheduleByRouteId(vehicle.routeId);
    if (!schedule) {
      throw new NotFoundException(
        `Schedule for route ${vehicle.routeId} not found`,
      );
    }

    const currentTime = payload.currentTime ?? this.currentTimeString();
    const currentMinutes = this.parseTimeToMinutes(currentTime);
    const startMinutes = this.parseTimeToMinutes(schedule.workStartTime);
    const endMinutes = this.parseTimeToMinutes(schedule.workEndTime);

    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      return {
        status: 'out_of_schedule',
        vehicleId: vehicle.id,
        fleetNumber: vehicle.fleetNumber,
        routeId: vehicle.routeId,
        currentTime,
        workStartTime: schedule.workStartTime,
        workEndTime: schedule.workEndTime,
      };
    }

    const passed = currentMinutes - startMinutes;
    const bucket = Math.floor(passed / schedule.intervalMin);
    const plannedMinutes = startMinutes + bucket * schedule.intervalMin;
    const deviationMin = this.roundTo1(currentMinutes - plannedMinutes);

    return {
      status: 'ok',
      vehicleId: vehicle.id,
      fleetNumber: vehicle.fleetNumber,
      routeId: vehicle.routeId,
      currentTime,
      plannedTime: this.formatMinutes(plannedMinutes),
      deviationMin,
      intervalMin: schedule.intervalMin,
    };
  }

  private async resolveRouteId(payload: {
    routeId?: number;
    routeNumber?: string;
    transportTypeId?: number;
    direction?: 'forward' | 'reverse';
  }) {
    if (payload.routeId) {
      return payload.routeId;
    }

    if (!payload.routeNumber || !payload.transportTypeId) {
      throw new BadRequestException(
        'routeId or routeNumber + transportTypeId is required',
      );
    }

    const conditions = [
      sql`number = ${payload.routeNumber}`,
      sql`transport_type_id = ${payload.transportTypeId}`,
    ];
    if (payload.direction) {
      conditions.push(sql`direction = ${payload.direction}`);
    }
    const whereClause = sql.join(conditions, sql.raw(' and '));

    const result = (await this.dbService.db.execute(sql`
      select id
      from guest_api.v_routes
      where ${whereClause}
      limit 1
    `)) as unknown as { rows: Array<{ id: number }> };

    const route = result.rows[0];
    if (!route) {
      throw new NotFoundException(
        `Route ${payload.routeNumber} (${payload.transportTypeId}) not found`,
      );
    }

    return route.id;
  }

  private async resolveVehicle(payload: {
    vehicleId?: number;
    fleetNumber?: string;
  }) {
    if (payload.vehicleId) {
      return this.findVehicleById(payload.vehicleId);
    }

    if (!payload.fleetNumber) {
      throw new BadRequestException('vehicleId or fleetNumber is required');
    }

    const vehicle = await this.findVehicleByFleet(payload.fleetNumber);
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${payload.fleetNumber} not found`);
    }

    return vehicle;
  }

  private parseTimeToMinutes(value: string) {
    const parts = value.split(':').map((part) => Number(part));

    if (parts.length < 2 || parts.length > 3 || parts.some(Number.isNaN)) {
      throw new BadRequestException(`Invalid time value: ${value}`);
    }

    const [hours, minutes, seconds = 0] = parts;

    if (
      hours < 0 ||
      hours > 23 ||
      minutes < 0 ||
      minutes > 59 ||
      seconds < 0 ||
      seconds > 59
    ) {
      throw new BadRequestException(`Invalid time value: ${value}`);
    }

    return hours * 60 + minutes + seconds / 60;
  }

  private formatMinutes(totalMinutes: number) {
    const totalSeconds = Math.round(totalMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600) % 24;
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${this.pad2(hours)}:${this.pad2(minutes)}:${this.pad2(seconds)}`;
  }

  private currentTimeString() {
    const now = new Date();
    return `${this.pad2(now.getHours())}:${this.pad2(now.getMinutes())}:${this.pad2(
      now.getSeconds(),
    )}`;
  }

  private pad2(value: number) {
    return value.toString().padStart(2, '0');
  }

  private roundTo1(value: number) {
    return Math.round(value * 10) / 10;
  }

  private async findScheduleById(id: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        route_id as "routeId",
        work_start_time as "workStartTime",
        work_end_time as "workEndTime",
        interval_min as "intervalMin"
      from guest_api.v_schedules
      where id = ${id}
      limit 1
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeId: number;
        workStartTime: string;
        workEndTime: string;
        intervalMin: number;
      }>;
    };

    const schedule = result.rows[0];
    if (!schedule) {
      throw new NotFoundException(`Schedule ${id} not found`);
    }

    return schedule;
  }

  private async findScheduleByRouteId(routeId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        route_id as "routeId",
        work_start_time as "workStartTime",
        work_end_time as "workEndTime",
        interval_min as "intervalMin"
      from guest_api.v_schedules
      where route_id = ${routeId}
      limit 1
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeId: number;
        workStartTime: string;
        workEndTime: string;
        intervalMin: number;
      }>;
    };

    return result.rows[0] ?? null;
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

  private async findVehiclesByRouteId(routeId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        fleet_number as "fleetNumber",
        route_id as "routeId"
      from dispatcher_api.v_vehicles
      where route_id = ${routeId}
      order by fleet_number
    `)) as unknown as {
      rows: Array<{
        id: number;
        fleetNumber: string;
        routeId: number;
      }>;
    };

    return result.rows;
  }

  private async findStopsByRouteId(routeId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        stop_id as "stopId",
        stop_name as "stopName",
        lon as "lon",
        lat as "lat",
        distance_to_next_km as "distanceToNextKm"
      from guest_api.v_route_stops
      where route_id = ${routeId}
      order by id
    `)) as unknown as {
      rows: Array<{
        stopId: number;
        stopName: string;
        lon: string;
        lat: string;
        distanceToNextKm: string | null;
      }>;
    };

    return result.rows;
  }

  private async findVehicleByFleet(fleetNumber: string) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        fleet_number as "fleetNumber",
        route_id as "routeId"
      from dispatcher_api.v_vehicles
      where fleet_number = ${fleetNumber}
      limit 1
    `)) as unknown as {
      rows: Array<{
        id: number;
        fleetNumber: string;
        routeId: number;
      }>;
    };

    return result.rows[0] ?? null;
  }

  private async findVehicleById(id: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        fleet_number as "fleetNumber",
        route_id as "routeId"
      from dispatcher_api.v_vehicles
      where id = ${id}
      limit 1
    `)) as unknown as {
      rows: Array<{
        id: number;
        fleetNumber: string;
        routeId: number;
      }>;
    };

    const vehicle = result.rows[0];
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }

    return vehicle;
  }

  private async findDriverById(id: number) {
    const result = (await this.dbService.db.execute(sql`
      select id
      from dispatcher_api.v_drivers
      where id = ${id}
      limit 1
    `)) as unknown as { rows: Array<{ id: number }> };

    if (!result.rows[0]) {
      throw new NotFoundException(`Driver ${id} not found`);
    }
  }

  private async findRoutePointsByRouteId(routeId: number) {
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

  private async findLatestVehicleGps(vehicleId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        vehicle_id as "vehicleId",
        lon as "lon",
        lat as "lat",
        recorded_at as "recordedAt"
      from dispatcher_api.v_vehicle_gps_latest
      where vehicle_id = ${vehicleId}
      limit 1
    `)) as unknown as {
      rows: Array<{
        vehicleId: number;
        lon: string;
        lat: string;
        recordedAt: Date;
      }>;
    };

    return result.rows[0] ?? null;
  }
}
