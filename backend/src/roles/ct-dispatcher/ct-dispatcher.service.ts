import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { transformToCamelCase } from '../../common/utils/transform-to-camel-case';
import { DbService } from '../../db/db.service';
import { AssignDriverDto } from './dto/assign-driver.dto';
import { CreateDispatcherScheduleDto } from './dto/create-schedule.dto';
import { DetectDeviationDto } from './dto/deviation.dto';
import { UpdateDispatcherScheduleDto } from './dto/update-schedule.dto';

const AVERAGE_SPEED_KMH = 25;

type MonitoringRow = {
  vehicleId: number;
  fleetNumber: string;
  routeId: number;
  routeNumber: string;
  routeDirection: string;
  transportType: string;
  lon: string | null;
  lat: string | null;
  lastRecordedAt: string | null;
  status: string;
  driverName: string | null;
};

type ActiveTripDeviationRow = {
  tripId: number;
  routeNumber: string;
  fleetNumber: string;
  driverName: string;
  plannedStartsAt: Date;
  actualStartsAt: Date | null;
  delayMinutes: number | null;
};

type StopRow = {
  id: number;
  stopId: number;
  stopName: string;
  prevRouteStopId: number | null;
  nextRouteStopId: number | null;
  distanceToNextKm: string | null;
  lon: string;
  lat: string;
};

type RoutePointRow = {
  id: number;
  routeId: number;
  lon: string;
  lat: string;
  prevRoutePointId: number | null;
  nextRoutePointId: number | null;
};

type VehicleRow = {
  id: number;
  fleetNumber: string;
  routeId: number;
  routeNumber: string;
  direction: string;
  transportTypeId: number;
  transportTypeName: string;
};

@Injectable()
export class CtDispatcherService {
  constructor(private readonly dbService: DbService) {}

  async createSchedule(payload: CreateDispatcherScheduleDto) {
    const vehicle = await this.resolveVehicle(payload);
    if (!vehicle) {
      throw new BadRequestException('Vehicle is required');
    }
    const route = await this.resolveRoute(payload, vehicle);
    if (!route) {
      throw new BadRequestException('Route is required');
    }

    // Vehicle can be used for its own route OR the paired route (forward ↔ reverse)
    if (!this.isVehicleMatchingRoute(vehicle.routeId, route)) {
      throw new BadRequestException(
        'Vehicle route does not match the selected route',
      );
    }

    const result = (await this.dbService.db.execute(sql`
      select dispatcher_api.create_schedule(
        ${route.id},
        ${vehicle.id},
        ${payload.workStartTime}::time,
        ${payload.workEndTime}::time,
        ${payload.intervalMin},
        ${payload.monday ?? true}::boolean,
        ${payload.tuesday ?? true}::boolean,
        ${payload.wednesday ?? true}::boolean,
        ${payload.thursday ?? true}::boolean,
        ${payload.friday ?? true}::boolean,
        ${payload.saturday ?? false}::boolean,
        ${payload.sunday ?? false}::boolean
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0]?.id };
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
      order by number, direction
    `)) as unknown as {
      rows: Array<{
        id: number;
        number: string;
        direction: string;
        transportTypeId: number;
        transportTypeName: string;
      }>;
    };

    return transformToCamelCase(result.rows) as Array<{
      id: number;
      number: string;
      direction: string;
      transportTypeId: number;
      transportTypeName: string;
    }>;
  }

  async listSchedules() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        route_id,
        route_number,
        direction,
        transport_type,
        work_start_time,
        work_end_time,
        interval_min,
        vehicle_id,
        fleet_number,
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
        sunday
      from dispatcher_api.v_schedules_list
      order by route_number
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeId: number;
        routeNumber: string;
        direction: string;
        transportType: string;
        workStartTime: string;
        workEndTime: string;
        intervalMin: number;
        vehicleId: number | null;
        fleetNumber: string | null;
        monday: boolean;
        tuesday: boolean;
        wednesday: boolean;
        thursday: boolean;
        friday: boolean;
        saturday: boolean;
        sunday: boolean;
      }>;
    };

    return transformToCamelCase(result.rows) as Array<{
      id: number;
      routeId: number;
      routeNumber: string;
      direction: string;
      transportType: string;
      workStartTime: string;
      workEndTime: string;
      intervalMin: number;
      vehicleId: number | null;
      fleetNumber: string | null;
      monday: boolean;
      tuesday: boolean;
      wednesday: boolean;
      thursday: boolean;
      friday: boolean;
      saturday: boolean;
      sunday: boolean;
    }>;
  }

  async listVehicles() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        fleet_number,
        route_id,
        route_number,
        capacity
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

    return transformToCamelCase(result.rows) as Array<{
      id: number;
      fleetNumber: string;
      routeId: number;
      routeNumber: string;
      capacity: number;
    }>;
  }

  async listDrivers() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        login,
        full_name,
        phone,
        driver_license_number
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

    return transformToCamelCase(result.rows) as Array<{
      id: number;
      login: string;
      fullName: string;
      phone: string;
      driverLicenseNumber: string;
    }>;
  }

  async listDriversByRoute(routeId: number) {
    const result = (await this.dbService.db.execute(sql`
      SELECT DISTINCT ON (dva.driver_id)
        dva.driver_id as id,
        d.full_name,
        d.login,
        d.phone,
        v.fleet_number,
        dva.assigned_at
      FROM public.driver_vehicle_assignments dva
      JOIN public.drivers d ON d.id = dva.driver_id
      JOIN public.vehicles v ON v.id = dva.vehicle_id
      WHERE v.route_id = ${routeId}
      ORDER BY dva.driver_id, dva.assigned_at DESC
    `)) as unknown as {
      rows: Array<{
        id: number;
        fullName: string;
        login: string;
        phone: string;
        fleetNumber: string;
        assignedAt: Date;
      }>;
    };

    return transformToCamelCase(result.rows) as Array<{
      id: number;
      fullName: string;
      login: string;
      phone: string;
      fleetNumber: string;
      assignedAt: Date;
    }>;
  }

  async listAssignments() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        driver_id,
        driver_name,
        driver_login,
        driver_phone,
        vehicle_id,
        fleet_number,
        route_id,
        route_number,
        direction,
        transport_type_id,
        transport_type,
        assigned_at
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

    return transformToCamelCase(result.rows) as Array<{
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
  }

  async listActiveTrips() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        route_number,
        fleet_number,
        full_name,
        planned_starts_at,
        actual_starts_at,
        start_delay_min
      from dispatcher_api.v_active_trips
      order by actual_starts_at desc
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeNumber: string;
        fleetNumber: string | null;
        fullName: string;
        plannedStartsAt: Date;
        actualStartsAt: Date;
        startDelayMin: number | null;
      }>;
    };

    return transformToCamelCase(result.rows) as Array<{
      id: number;
      routeNumber: string;
      fleetNumber: string | null;
      fullName: string;
      plannedStartsAt: Date;
      actualStartsAt: Date;
      startDelayMin: number | null;
    }>;
  }

  async listTrips(status?: string) {
    const statusFilter = status ? sql`where status = ${status}` : sql``;
    const result = (await this.dbService.db.execute(sql`
      select
        id, route_id, route_number, direction, transport_type,
        vehicle_id, fleet_number, driver_id, driver_name, driver_login,
        planned_starts_at, planned_ends_at,
        actual_starts_at, actual_ends_at,
        status, passenger_count, start_delay_min
      from dispatcher_api.v_trips_list
      ${statusFilter}
      order by planned_starts_at desc
      limit 100
    `)) as unknown as { rows: unknown[] };

    return transformToCamelCase(result.rows);
  }

  async createTrip(payload: {
    routeId: number;
    driverId: number;
    plannedStartsAt: Date;
    plannedEndsAt?: Date;
  }) {
    const result = (await this.dbService.db.execute(sql`
      select dispatcher_api.create_trip(
        ${payload.routeId}::bigint,
        ${payload.driverId}::bigint,
        ${payload.plannedStartsAt.toISOString()}::timestamp,
        ${payload.plannedEndsAt?.toISOString() ?? null}::timestamp
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0]?.id };
  }

  async cancelTrip(tripId: number) {
    await this.dbService.db.execute(sql`
      select dispatcher_api.cancel_trip(${tripId}::bigint)
    `);
    return { ok: true };
  }

  async deleteTrip(tripId: number) {
    await this.dbService.db.execute(sql`
      select dispatcher_api.delete_trip(${tripId}::bigint)
    `);
    return { ok: true };
  }

  async listDeviations() {
    const result = (await this.dbService.db.execute(sql`
      select
        trip_id,
        route_number,
        fleet_number,
        driver_name,
        planned_starts_at,
        actual_starts_at,
        delay_minutes
      from dispatcher_api.v_active_trip_deviations
      order by delay_minutes desc nulls last
    `)) as unknown as { rows: ActiveTripDeviationRow[] };

    return transformToCamelCase(result.rows);
  }

  async getDashboard() {
    // Single DB call replaces 6 parallel queries
    const result = (await this.dbService.db.execute(sql`
      SELECT * FROM dispatcher_api.get_dashboard()
    `)) as unknown as {
      rows: Array<{
        active_trips: number;
        deviations: number;
        schedules_today: number;
        unassigned_drivers: number;
        unassigned_vehicles: number;
      }>;
    };

    const row = result.rows[0];
    return {
      activeTrips: row?.active_trips ?? 0,
      deviations: row?.deviations ?? 0,
      schedulesToday: row?.schedules_today ?? 0,
      unassignedDrivers: row?.unassigned_drivers ?? 0,
      unassignedVehicles: row?.unassigned_vehicles ?? 0,
    };
  }

  async getRoutePoints(routeId: number) {
    // Use ordered view (replaces orderRoutePoints)
    const result = (await this.dbService.db.execute(sql`
      SELECT id, route_id, lon, lat, prev_route_point_id, next_route_point_id, sort_order
      FROM guest_api.v_route_points_ordered
      WHERE route_id = ${routeId}
      ORDER BY sort_order
    `)) as unknown as {
      rows: RoutePointRow[];
    };

    return transformToCamelCase(result.rows);
  }

  async updateSchedule(id: number, payload: UpdateDispatcherScheduleDto) {
    const vehicle = await this.resolveVehicle(payload, { allowMissing: true });
    const route = await this.resolveRoute(payload, vehicle, {
      allowMissing: true,
    });

    // Vehicle can be used for its own route OR the paired route (forward ↔ reverse)
    if (vehicle && route && !this.isVehicleMatchingRoute(vehicle.routeId, route)) {
      throw new BadRequestException(
        'Vehicle route does not match the selected route',
      );
    }

    await this.dbService.db.execute(sql`
      select dispatcher_api.update_schedule(
        ${id},
        ${route?.id ?? null}::bigint,
        ${vehicle?.id ?? null}::bigint,
        ${payload.workStartTime ?? null}::time,
        ${payload.workEndTime ?? null}::time,
        ${payload.intervalMin ?? null}::integer,
        ${payload.monday ?? null}::boolean,
        ${payload.tuesday ?? null}::boolean,
        ${payload.wednesday ?? null}::boolean,
        ${payload.thursday ?? null}::boolean,
        ${payload.friday ?? null}::boolean,
        ${payload.saturday ?? null}::boolean,
        ${payload.sunday ?? null}::boolean
      )
    `);

    return { ok: true };
  }

  async deleteSchedule(id: number) {
    try {
      await this.dbService.db.execute(sql`
        SELECT dispatcher_api.delete_schedule(${id}::bigint)
      `);
      return { ok: true };
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new NotFoundException(`Schedule ${id} not found`);
      }
      throw error;
    }
  }

  async getScheduleDetails(id: number) {
    const schedule = await this.findScheduleById(id);

    // Use DB function for ordered stops with timing (replaces buildStopsWithTiming + orderRouteStops)
    const stopsResult = (await this.dbService.db.execute(sql`
      SELECT * FROM guest_api.get_route_stops_with_timing(${schedule.routeId})
    `)) as unknown as {
      rows: Array<{
        id: number;
        stop_id: number;
        stop_name: string;
        lon: string;
        lat: string;
        sort_order: number;
        distance_to_next_km: number | null;
        minutes_to_next_stop: number | null;
        minutes_from_start: number | null;
      }>;
    };

    const stopsWithIntervals = stopsResult.rows.map((stop) => ({
      id: stop.stop_id,
      name: stop.stop_name,
      lon: stop.lon,
      lat: stop.lat,
      distanceToNextKm: stop.distance_to_next_km,
      minutesToNextStop: stop.minutes_to_next_stop,
    }));

    const totalMinutes = stopsResult.rows.reduce(
      (sum, stop) => sum + (stop.minutes_to_next_stop ?? 0),
      0,
    );

    const routeDurationMin =
      stopsWithIntervals.length > 0 ? this.roundTo1(totalMinutes) : null;
    const routeEndTime =
      routeDurationMin !== null
        ? this.addMinutes(schedule.workStartTime, routeDurationMin)
        : null;

    // Use DB function for departure times (replaces buildDepartureTimes)
    const departuresResult = (await this.dbService.db.execute(sql`
      SELECT * FROM dispatcher_api.get_departure_times(
        ${schedule.workStartTime}::time,
        ${schedule.workEndTime}::time,
        ${schedule.intervalMin}
      )
    `)) as unknown as { rows: Array<{ departure_time: string }> };

    const departures = departuresResult.rows.map((r) => r.departure_time);

    return {
      id: schedule.id,
      routeNumber: schedule.routeNumber,
      routeDirection: schedule.routeDirection,
      transportType: schedule.transportType,
      fleetNumber: schedule.fleetNumber,
      workStartTime: schedule.workStartTime,
      workEndTime: schedule.workEndTime,
      intervalMin: schedule.intervalMin,
      routeDurationMin,
      routeEndTime,
      departures,
      stops: stopsWithIntervals,
    };
  }

  async assignDriver(payload: AssignDriverDto) {
    const driverId = await this.resolveDriverId(payload);
    const vehicle = await this.resolveVehicle(payload);
    if (!vehicle) {
      throw new BadRequestException('Vehicle is required');
    }

    if (payload.routeNumber && vehicle.routeNumber !== payload.routeNumber) {
      throw new BadRequestException('Vehicle does not match route number');
    }
    if (
      payload.transportTypeId &&
      vehicle.transportTypeId !== payload.transportTypeId
    ) {
      throw new BadRequestException('Vehicle does not match transport type');
    }
    if (payload.direction && vehicle.direction !== payload.direction) {
      throw new BadRequestException('Vehicle does not match route direction');
    }

    await this.dbService.db.execute(sql`
      select dispatcher_api.assign_driver_v2(
        ${driverId},
        ${vehicle.fleetNumber}
      )
    `);

    return { ok: true };
  }

  async monitorVehicle(fleetNumber: string) {
    const result = (await this.dbService.db.execute(sql`
      select 
         id,
         fleet_number,
         route_id,
         route_number,
         direction as "routeDirection",
         transport_type,
         last_lon,
         last_lat,
         last_recorded_at,
         status,
         current_driver_name
      from dispatcher_api.v_vehicle_monitoring
      where fleet_number = ${fleetNumber}
      limit 1
    `)) as unknown as { rows: MonitoringRow[] };

    const monitoring = transformToCamelCase(result.rows)[0];
    if (!monitoring) {
      throw new NotFoundException(
        `Vehicle ${fleetNumber} not found in monitoring`,
      );
    }

    let points: RoutePointRow[] = [];
    if (monitoring.routeId) {
      points = await this.getRoutePoints(monitoring.routeId);
    }

    return {
      vehicle: {
        ...monitoring,
        recordedAt: monitoring.lastRecordedAt,
      },
      routePoints: points,
    };
  }

  async detectDeviation(fleetNumber: string, _payload: DetectDeviationDto) {
    const tripResult = (await this.dbService.db.execute(sql`
      select
        id,
        route_number,
        fleet_number,
        full_name,
        starts_at
      from dispatcher_api.v_active_trips
      where fleet_number = ${fleetNumber}
      order by starts_at desc
      limit 1
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeNumber: string;
        fleetNumber: string;
        driverName: string;
        startsAt: Date;
      }>;
    };

    const trip = (
      transformToCamelCase(tripResult.rows) as Array<{
        id: number;
        routeNumber: string;
        fleetNumber: string;
        driverName: string;
        startsAt: Date;
      }>
    )[0];
    if (!trip) {
      throw new NotFoundException('Active trip not found for vehicle');
    }

    const delayResult = (await this.dbService.db.execute(sql`
      select dispatcher_api.calculate_delay(${trip.id}) as "delayMinutes"
    `)) as unknown as { rows: Array<{ delayMinutes: number | null }> };

    const delayMinutes = delayResult.rows[0]?.delayMinutes ?? null;
    const status =
      delayMinutes == null
        ? 'unknown'
        : delayMinutes > 5
          ? 'late'
          : delayMinutes < -5
            ? 'early'
            : 'on time';

    return {
      fleetNumber: trip.fleetNumber,
      tripId: trip.id,
      routeNumber: trip.routeNumber,
      driverName: trip.driverName,
      startsAt: trip.startsAt,
      delayMinutes,
      status,
    };
  }

  // --- Helpers ---

  /**
   * Check if vehicle can be used for the given route.
   * Vehicle matches if:
   * - vehicleRouteId === route.id (same route)
   * - vehicleRouteId === route.pairedRouteId (paired route, e.g., forward ↔ reverse)
   */
  private isVehicleMatchingRoute(
    vehicleRouteId: number,
    route: { id: number; pairedRouteId?: number | null },
  ): boolean {
    if (vehicleRouteId === route.id) {
      return true;
    }
    if (route.pairedRouteId && vehicleRouteId === route.pairedRouteId) {
      return true;
    }
    return false;
  }

  private async findRouteById(routeId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        number,
        transport_type_id,
        direction,
        paired_route_id
      from guest_api.v_routes
      where id = ${routeId}
      limit 1
    `)) as unknown as {
      rows: Array<{
        id: number;
        number: string;
        transportTypeId: number;
        direction: string;
        pairedRouteId: number | null;
      }>;
    };

    const route = (
      transformToCamelCase(result.rows) as Array<{
        id: number;
        number: string;
        transportTypeId: number;
        direction: string;
        pairedRouteId: number | null;
      }>
    )[0];
    if (!route) {
      throw new NotFoundException(`Route ${routeId} not found`);
    }

    return route;
  }

  private async findRouteByNumberAndType(
    routeNumber: string,
    transportTypeId: number,
    direction?: string,
  ) {
    const conditions = [
      sql`number = ${routeNumber}`,
      sql`transport_type_id = ${transportTypeId}`,
    ];
    if (direction) {
      conditions.push(sql`direction = ${direction}`);
    }
    const whereClause = sql.join(conditions, sql.raw(' and '));
    const orderClause = direction
      ? sql``
      : sql`order by (direction = 'forward') desc, id`;

    const result = (await this.dbService.db.execute(sql`
      select
        id,
        number,
        transport_type_id,
        direction,
        paired_route_id
      from guest_api.v_routes
      where ${whereClause}
      ${orderClause}
      limit 1
    `)) as unknown as {
      rows: Array<{
        id: number;
        number: string;
        transportTypeId: number;
        direction: string;
        pairedRouteId: number | null;
      }>;
    };

    const route = (
      transformToCamelCase(result.rows) as Array<{
        id: number;
        number: string;
        transportTypeId: number;
        direction: string;
        pairedRouteId: number | null;
      }>
    )[0];
    if (!route) {
      throw new NotFoundException(
        `Route ${routeNumber} (${transportTypeId}) not found`,
      );
    }

    return route;
  }

  private async findVehicleByFleetNumber(fleetNumber: string) {
    const result = (await this.dbService.db.execute(sql`
      select
        v.id,
        v.fleet_number,
        v.route_id,
        v.route_number,
        r.direction,
        r.transport_type_id,
        r.transport_type_name
      from dispatcher_api.v_vehicles_list v
      left join guest_api.v_routes r on r.id = v.route_id
      where v.fleet_number = ${fleetNumber}
      limit 1
    `)) as unknown as { rows: VehicleRow[] };

    const vehicle = transformToCamelCase(result.rows)[0];
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${fleetNumber} not found`);
    }

    return vehicle;
  }

  private async findVehicleById(vehicleId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        v.id,
        v.fleet_number,
        v.route_id,
        v.route_number,
        r.direction,
        r.transport_type_id,
        r.transport_type_name
      from dispatcher_api.v_vehicles_list v
      left join guest_api.v_routes r on r.id = v.route_id
      where v.id = ${vehicleId}
      limit 1
    `)) as unknown as { rows: VehicleRow[] };

    const vehicle = transformToCamelCase(result.rows)[0];
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${vehicleId} not found`);
    }

    return vehicle;
  }

  private async resolveVehicle(
    payload: { vehicleId?: number; fleetNumber?: string },
    options?: { allowMissing?: boolean },
  ) {
    if (payload.vehicleId) {
      return this.findVehicleById(payload.vehicleId);
    }
    if (payload.fleetNumber) {
      return this.findVehicleByFleetNumber(payload.fleetNumber);
    }
    if (options?.allowMissing) {
      return null;
    }
    throw new BadRequestException('vehicleId or fleetNumber is required');
  }

  private async resolveRoute(
    payload: {
      routeId?: number;
      routeNumber?: string;
      transportTypeId?: number;
      direction?: string;
    },
    vehicle?: VehicleRow | null,
    options?: { allowMissing?: boolean },
  ) {
    if (payload.routeId) {
      return this.findRouteById(payload.routeId);
    }

    if (payload.routeNumber) {
      const transportTypeId =
        payload.transportTypeId ?? vehicle?.transportTypeId;
      if (!transportTypeId) {
        throw new BadRequestException('transportTypeId is required');
      }
      return this.findRouteByNumberAndType(
        payload.routeNumber,
        transportTypeId,
        payload.direction ?? vehicle?.direction,
      );
    }

    if (vehicle) {
      return this.findRouteById(vehicle.routeId);
    }

    if (options?.allowMissing) {
      return null;
    }

    throw new BadRequestException('Route is required');
  }

  private async findScheduleById(id: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        route_id,
        route_number,
        direction as "routeDirection",
        transport_type,
        work_start_time,
        work_end_time,
        interval_min,
        vehicle_id,
        fleet_number
      from dispatcher_api.v_schedules_list
      where id = ${id}
      limit 1
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeId: number;
        routeNumber: string;
        routeDirection: string;
        transportType: string;
        workStartTime: string;
        workEndTime: string;
        intervalMin: number;
        vehicleId: number | null;
        fleetNumber: string | null;
      }>;
    };

    const schedule = (
      transformToCamelCase(result.rows) as Array<{
        id: number;
        routeId: number;
        routeNumber: string;
        routeDirection: string;
        transportType: string;
        workStartTime: string;
        workEndTime: string;
        intervalMin: number;
        vehicleId: number | null;
        fleetNumber: string | null;
      }>
    )[0];
    if (!schedule) {
      throw new NotFoundException(`Schedule ${id} not found`);
    }

    return schedule;
  }

  private async findScheduleByRouteAndVehicle(
    routeId: number,
    vehicleId: number,
  ) {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        route_id,
        route_number,
        direction as "routeDirection",
        transport_type,
        work_start_time,
        work_end_time,
        interval_min,
        vehicle_id,
        fleet_number
      from dispatcher_api.v_schedules_list
      where route_id = ${routeId}
      order by (vehicle_id = ${vehicleId}) desc, id
      limit 1
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeId: number;
        routeNumber: string;
        routeDirection: string;
        transportType: string;
        workStartTime: string;
        workEndTime: string;
        intervalMin: number;
        vehicleId: number | null;
        fleetNumber: string | null;
      }>;
    };

    const schedules = transformToCamelCase(result.rows) as Array<{
      id: number;
      routeId: number;
      routeNumber: string;
      routeDirection: string;
      transportType: string;
      workStartTime: string;
      workEndTime: string;
      intervalMin: number;
      vehicleId: number | null;
      fleetNumber: string | null;
    }>;

    return schedules[0] ?? null;
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

  private async findRouteStops(routeId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        route_id,
        stop_id,
        stop_name,
        lon,
        lat,
        prev_route_stop_id,
        next_route_stop_id,
        distance_to_next_km
      from guest_api.v_route_stops
      where route_id = ${routeId}
    `)) as unknown as { rows: StopRow[] };

    return transformToCamelCase(result.rows);
  }

  private orderRouteStops<
    T extends {
      id: number;
      prevRouteStopId: number | null;
      nextRouteStopId: number | null;
    },
  >(rows: T[]): T[] {
    if (rows.length === 0) {
      return rows;
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    const start = rows.find((row) => row.prevRouteStopId === null);

    if (!start) {
      return rows.sort((a, b) => a.id - b.id);
    }

    const ordered: T[] = [];
    const visited = new Set<number>();
    let current: T | undefined = start;

    while (current && !visited.has(current.id)) {
      ordered.push(current);
      visited.add(current.id);
      current = current.nextRouteStopId
        ? byId.get(current.nextRouteStopId)
        : undefined;
    }

    if (ordered.length !== rows.length) {
      return rows.sort((a, b) => a.id - b.id);
    }

    return ordered;
  }

  private orderRoutePoints(rows: RoutePointRow[]): RoutePointRow[] {
    if (rows.length === 0) {
      return rows;
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    const start = rows.find((row) => row.prevRoutePointId === null);

    if (!start) {
      return rows.sort((a, b) => a.id - b.id);
    }

    const ordered: RoutePointRow[] = [];
    const visited = new Set<number>();
    let current: RoutePointRow | undefined = start;

    while (current && !visited.has(current.id)) {
      ordered.push(current);
      visited.add(current.id);
      current = current.nextRoutePointId
        ? byId.get(current.nextRoutePointId)
        : undefined;
    }

    if (ordered.length !== rows.length) {
      return rows.sort((a, b) => a.id - b.id);
    }

    return ordered;
  }

  private buildStopsWithTiming(stops: StopRow[], routePoints: RoutePointRow[]) {
    let cumulativeMinutes = 0;
    const points = routePoints ?? [];
    const pointDistances =
      points.length >= 2 ? this.buildPointDistances(points) : null;
    const stopPointIndexes = pointDistances
      ? this.mapStopsToPointIndexes(stops, points)
      : new Map<number, number>();
    const startIndex =
      stops.length > 0 ? stopPointIndexes.get(stops[0].id) : undefined;

    return stops.map((stop, index) => {
      const distanceKm = stop.distanceToNextKm
        ? Number(stop.distanceToNextKm)
        : null;
      const currentPointIndex = stopPointIndexes.get(stop.id);
      const nextStop = stops[index + 1];
      const nextPointIndex = nextStop
        ? stopPointIndexes.get(nextStop.id)
        : undefined;

      let minutesToNextStop: number | null = null;
      if (
        pointDistances &&
        currentPointIndex != null &&
        nextPointIndex != null
      ) {
        const segmentKm = Math.max(
          0,
          pointDistances[nextPointIndex] - pointDistances[currentPointIndex],
        );
        minutesToNextStop = this.roundTo1((segmentKm / AVERAGE_SPEED_KMH) * 60);
      } else if (distanceKm !== null) {
        minutesToNextStop = this.roundTo1(
          (distanceKm / AVERAGE_SPEED_KMH) * 60,
        );
      }

      let minutesFromStart: number | null = null;
      if (pointDistances && startIndex != null && currentPointIndex != null) {
        const distanceFromStartKm =
          pointDistances[currentPointIndex] - pointDistances[startIndex];
        minutesFromStart = this.roundTo1(
          (distanceFromStartKm / AVERAGE_SPEED_KMH) * 60,
        );
      }

      if (minutesFromStart === null) {
        minutesFromStart = this.roundTo1(cumulativeMinutes);
      }

      if (minutesToNextStop !== null) {
        cumulativeMinutes += minutesToNextStop;
      }

      return {
        id: stop.stopId,
        name: stop.stopName,
        lon: stop.lon,
        lat: stop.lat,
        distanceToNextKm: distanceKm,
        minutesFromStart,
        minutesToNextStop,
      };
    });
  }

  private buildPointDistances(points: RoutePointRow[]) {
    const distances: number[] = [0];
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const next = points[i];
      const segmentKm = this.haversineKm(
        Number(prev.lon),
        Number(prev.lat),
        Number(next.lon),
        Number(next.lat),
      );
      distances.push(distances[i - 1] + segmentKm);
    }
    return distances;
  }

  private mapStopsToPointIndexes(stops: StopRow[], points: RoutePointRow[]) {
    const map = new Map<number, number>();
    for (const stop of stops) {
      const idx = this.findNearestPointIndex(stop, points);
      if (idx != null) {
        map.set(stop.id, idx);
      }
    }
    return map;
  }

  private findNearestPointIndex(stop: StopRow, points: RoutePointRow[]) {
    const stopLon = Number(stop.lon);
    const stopLat = Number(stop.lat);
    if (!Number.isFinite(stopLon) || !Number.isFinite(stopLat)) {
      return null;
    }

    let minDistance = Number.POSITIVE_INFINITY;
    let minIndex: number | null = null;
    points.forEach((point, index) => {
      const distance = this.haversineKm(
        stopLon,
        stopLat,
        Number(point.lon),
        Number(point.lat),
      );
      if (distance < minDistance) {
        minDistance = distance;
        minIndex = index;
      }
    });

    return minIndex;
  }

  private haversineKm(lon1: number, lat1: number, lon2: number, lat2: number) {
    const toRad = (value: number) => (value * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 6371 * c;
  }

  private findNearestStop(
    stops: Array<{
      id: number;
      name: string;
      lon: string;
      lat: string;
      minutesFromStart: number;
    }>,
    location: { lon: number; lat: number },
  ) {
    let best = stops[0];
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const stop of stops) {
      const distance = this.getDistanceKm(
        location.lat,
        location.lon,
        Number(stop.lat),
        Number(stop.lon),
      );
      if (distance < bestDistance) {
        bestDistance = distance;
        best = stop;
      }
    }

    return best;
  }

  private resolveLocation(payload: DetectDeviationDto, vehicle: MonitoringRow) {
    const lon =
      payload.lon ?? (vehicle.lon !== null ? Number(vehicle.lon) : null);
    const lat =
      payload.lat ?? (vehicle.lat !== null ? Number(vehicle.lat) : null);

    if (
      lon === null ||
      lat === null ||
      Number.isNaN(lon) ||
      Number.isNaN(lat)
    ) {
      return null;
    }

    return { lon, lat };
  }

  private buildDepartureTimes(
    workStartTime: string,
    workEndTime: string,
    intervalMin: number,
  ) {
    const startMin = this.parseTimeToMinutes(workStartTime);
    const endMin = this.parseTimeToMinutes(workEndTime);
    if (intervalMin <= 0 || endMin < startMin) {
      return [];
    }

    const departures: string[] = [];
    for (let minute = startMin; minute <= endMin; minute += intervalMin) {
      departures.push(this.formatMinutes(minute));
    }
    return departures;
  }

  private resolvePlannedDepartureMinutes(
    workStartTime: string,
    workEndTime: string,
    intervalMin: number,
    currentMinutes: number,
  ) {
    const startMin = this.parseTimeToMinutes(workStartTime);
    const endMin = this.parseTimeToMinutes(workEndTime);
    if (intervalMin <= 0) {
      return startMin;
    }
    if (currentMinutes <= startMin) {
      return startMin;
    }

    const effectiveEnd = Math.max(endMin, startMin);
    const lastDeparture =
      startMin +
      Math.floor((effectiveEnd - startMin) / intervalMin) * intervalMin;
    const candidate =
      startMin +
      Math.floor((currentMinutes - startMin) / intervalMin) * intervalMin;

    if (candidate > effectiveEnd) {
      return lastDeparture;
    }

    return candidate;
  }

  private parseTimeToMinutes(value: string) {
    if (value.includes('T')) {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime())) {
        return (
          date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60
        );
      }
    }
    const [hoursRaw, minutesRaw, secondsRaw] = value.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw ?? 0);
    const seconds = Number(secondsRaw ?? 0);
    return hours * 60 + minutes + seconds / 60;
  }

  private formatMinutes(minutesTotal: number) {
    const normalized = this.normalizeMinutes(minutesTotal);
    const rounded = Math.round(normalized);
    const hours = Math.floor(rounded / 60) % 24;
    const minutes = rounded % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}`;
  }

  private addMinutes(time: string, minutesToAdd: number) {
    const total = this.parseTimeToMinutes(time) + minutesToAdd;
    return this.formatMinutes(total);
  }

  private normalizeMinutes(minutesTotal: number) {
    const day = 24 * 60;
    return ((minutesTotal % day) + day) % day;
  }

  private getCurrentMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  }

  private getDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private roundTo1(value: number) {
    return Math.round(value * 10) / 10;
  }
}
