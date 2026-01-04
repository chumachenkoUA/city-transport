import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { FinishTripDto } from './dto/finish-trip.dto';
import { GpsLogDto } from './dto/gps-log.dto';
import { PassengerCountDto } from './dto/passenger-count.dto';
import { RouteLookupDto } from './dto/route-lookup.dto';
import { StartTripDto } from './dto/start-trip.dto';

const AVERAGE_SPEED_KMH = 25;

type DriverProfileRow = {
  id: number;
  login: string;
  fullName: string;
  email: string;
  phone: string;
  driverLicenseNumber: string;
  licenseCategories: unknown;
};

type DriverScheduleRow = {
  id: number;
  startsAt: Date;
  endsAt: Date | null;
  routeId: number;
  routeNumber: string;
  routeDirection: string;
  transportTypeId: number;
  transportTypeName: string;
  vehicleId: number;
  fleetNumber: string;
};

type RouteStopRow = {
  stopId: number;
  stopName: string;
  lon: string;
  lat: string;
  distanceToNextKm: string | null;
};

type ScheduleRow = {
  workStartTime: string;
  workEndTime: string;
  intervalMin: number;
};

type ActiveTripRow = {
  id: number;
  startsAt: Date;
  endsAt: Date | null;
  routeId: number;
  routeNumber: string;
  routeDirection: string;
  transportTypeId: number;
  transportTypeName: string;
  vehicleId: number;
  fleetNumber: string;
};

type RoutePointRow = {
  id: number;
  routeId: number;
  lon: string;
  lat: string;
  prevRoutePointId: number | null;
  nextRoutePointId: number | null;
};

@Injectable()
export class CtDriverService {
  constructor(private readonly dbService: DbService) {}

  async getProfile(_login: string) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        login as "login",
        full_name as "fullName",
        email as "email",
        phone as "phone",
        driver_license_number as "driverLicenseNumber",
        license_categories as "licenseCategories"
      from driver_api.v_profile
      limit 1
    `)) as unknown as { rows: DriverProfileRow[] };

    const driver = result.rows[0];
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return driver;
  }

  async getScheduleByLogin(_login: string, date?: string) {
    const driver = await this.getProfile(_login);
    const targetDate = this.parseDate(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const tripsResult = (await this.dbService.db.execute(sql`
      select
        id as "id",
        starts_at as "startsAt",
        ends_at as "endsAt",
        route_id as "routeId",
        route_number as "routeNumber",
        direction as "routeDirection",
        transport_type_id as "transportTypeId",
        transport_type as "transportTypeName",
        vehicle_id as "vehicleId",
        fleet_number as "fleetNumber"
      from driver_api.v_my_schedule
      where starts_at >= ${startOfDay} and starts_at < ${endOfDay}
      order by starts_at
    `)) as unknown as { rows: DriverScheduleRow[] };

    const trips = tripsResult.rows;
    const routeIds = Array.from(new Set(trips.map((trip) => trip.routeId)));
    const stopsByRouteId = new Map<number, RouteStopRow[]>();

    for (const routeId of routeIds) {
      const stopsResult = (await this.dbService.db.execute(sql`
        select
          stop_id as "stopId",
          stop_name as "stopName",
          lon as "lon",
          lat as "lat",
          distance_to_next_km as "distanceToNextKm"
        from guest_api.v_route_stops
        where route_id = ${routeId}
        order by id
      `)) as unknown as { rows: RouteStopRow[] };

      stopsByRouteId.set(routeId, stopsResult.rows);
    }

    const tripsWithStops = trips.map((trip) => {
      const stops = stopsByRouteId.get(trip.routeId) ?? [];
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
        id: trip.id,
        startsAt: trip.startsAt instanceof Date ? trip.startsAt.toISOString() : trip.startsAt,
        endsAt: trip.endsAt instanceof Date ? trip.endsAt.toISOString() : trip.endsAt,
        route: {
          id: trip.routeId,
          number: trip.routeNumber,
          transportTypeId: trip.transportTypeId,
          direction: trip.routeDirection,
        },
        vehicle: {
          id: trip.vehicleId,
          fleetNumber: trip.fleetNumber,
        },
        transportType: {
          id: trip.transportTypeId,
          name: trip.transportTypeName,
        },
        stops: stopsWithIntervals,
      };
    });

    const primaryTrip = tripsWithStops[0];
    const scheduleRow = primaryTrip
      ? await this.findScheduleByRouteId(primaryTrip.route.id)
      : null;

    return {
      driver,
      date: this.toDateString(targetDate),
      assigned: tripsWithStops.length > 0,
      vehicle: primaryTrip?.vehicle,
      route: primaryTrip?.route,
      transportType: primaryTrip?.transportType,
      schedule: scheduleRow ?? null,
      trips: tripsWithStops,
      stops: primaryTrip?.stops ?? [],
    };
  }

  async getActiveTripByLogin(_login: string) {
    const now = new Date();
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        starts_at as "startsAt",
        ends_at as "endsAt",
        route_id as "routeId",
        route_number as "routeNumber",
        direction as "routeDirection",
        transport_type_id as "transportTypeId",
        transport_type as "transportTypeName",
        vehicle_id as "vehicleId",
        fleet_number as "fleetNumber"
      from driver_api.v_my_schedule
      where starts_at <= ${now}
        and (ends_at is null or ends_at >= ${now})
      order by starts_at desc
      limit 1
    `)) as unknown as { rows: ActiveTripRow[] };

    const activeTrip = result.rows[0];
    if (!activeTrip) {
      return null;
    }

    return {
      id: activeTrip.id,
      startsAt: activeTrip.startsAt,
      endsAt: activeTrip.endsAt,
      route: {
        id: activeTrip.routeId,
        number: activeTrip.routeNumber,
        transportTypeId: activeTrip.transportTypeId,
        direction: activeTrip.routeDirection,
      },
      vehicle: {
        id: activeTrip.vehicleId,
        fleetNumber: activeTrip.fleetNumber,
      },
      transportType: {
        id: activeTrip.transportTypeId,
        name: activeTrip.transportTypeName,
      },
    };
  }

  async getRouteStops(payload: RouteLookupDto) {
    const routeId = await this.resolveRouteId(payload);
    const result = (await this.dbService.db.execute(sql`
      select
        route_id as "routeId",
        stop_id as "stopId",
        stop_name as "stopName",
        lon as "lon",
        lat as "lat",
        distance_to_next_km as "distanceToNextKm",
        prev_route_stop_id as "prevRouteStopId",
        next_route_stop_id as "nextRouteStopId"
      from guest_api.v_route_stops
      where route_id = ${routeId}
      order by id
    `)) as unknown as { rows: Array<Record<string, unknown>> };

    return result.rows;
  }

  async getRoutePoints(payload: RouteLookupDto) {
    const routeId = await this.resolveRouteId(payload);
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        route_id as "routeId",
        lon as "lon",
        lat as "lat",
        prev_route_point_id as "prevRoutePointId",
        next_route_point_id as "nextRoutePointId"
      from guest_api.v_route_points
      where route_id = ${routeId}
      order by id
    `)) as unknown as { rows: RoutePointRow[] };

    return result.rows;
  }

  async startTrip(_login: string, payload: StartTripDto) {
    if (!payload.fleetNumber) {
      throw new BadRequestException('fleetNumber is required');
    }

    const startedAt = payload.startedAt ?? new Date();
    const direction = payload.direction ?? 'forward';
    const result = (await this.dbService.db.execute(sql`
      select driver_api.start_trip(
        ${payload.fleetNumber},
        ${startedAt},
        ${direction}
      ) as "tripId"
    `)) as unknown as { rows: Array<{ tripId: number }> };

    return result.rows[0] ?? { tripId: null };
  }

  async finishTrip(_login: string, payload: FinishTripDto) {
    const endedAt = payload.endedAt ?? new Date();
    const result = (await this.dbService.db.execute(sql`
      select driver_api.finish_trip(${endedAt}) as "tripId"
    `)) as unknown as { rows: Array<{ tripId: number }> };

    return result.rows[0] ?? { tripId: null };
  }

  async setPassengerCount(_login: string, payload: PassengerCountDto) {
    await this.dbService.db.execute(sql`
      select driver_api.update_passengers(${payload.tripId}::bigint, ${payload.passengerCount}::integer)
    `);

    return { ok: true };
  }

  async logGps(_login: string, payload: GpsLogDto) {
    const recordedAt = payload.recordedAt ?? new Date().toISOString();
    await this.dbService.db.execute(sql`
      select driver_api.log_vehicle_gps(
        ${payload.lon},
        ${payload.lat},
        ${recordedAt}::timestamp
      )
    `);
    return { ok: true };
  }

  private async resolveRouteId(payload: RouteLookupDto) {
    if (payload.routeId) {
      return payload.routeId;
    }

    if (!payload.routeNumber) {
      throw new BadRequestException('routeId or routeNumber is required');
    }

    const conditions = [sql`number = ${payload.routeNumber}`];
    if (payload.transportTypeId) {
      conditions.push(sql`transport_type_id = ${payload.transportTypeId}`);
    }
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
        `Route ${payload.routeNumber} (${payload.transportTypeId ?? 'any'}) not found`,
      );
    }

    return route.id;
  }

  private async findScheduleByRouteId(routeId: number): Promise<ScheduleRow | null> {
    const result = (await this.dbService.db.execute(sql`
      select
        work_start_time as "workStartTime",
        work_end_time as "workEndTime",
        interval_min as "intervalMin"
      from guest_api.v_schedules
      where route_id = ${routeId}
      limit 1
    `)) as unknown as { rows: ScheduleRow[] };

    return result.rows[0] ?? null;
  }

  private roundTo1(value: number) {
    return Math.round(value * 10) / 10;
  }

  private parseDate(value?: string) {
    if (!value) {
      return new Date();
    }

    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) {
      throw new BadRequestException('Invalid date format');
    }

    return new Date(year, month - 1, day);
  }

  private toDateString(date: Date) {
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
