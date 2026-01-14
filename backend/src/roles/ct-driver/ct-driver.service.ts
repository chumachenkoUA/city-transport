import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { transformToCamelCase } from '../../common/utils/transform-to-camel-case';
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

type OrderedRouteStopRow = RouteStopRow & {
  id: number;
  prevRouteStopId: number | null;
  nextRouteStopId: number | null;
};

type ScheduleRow = {
  workStartTime: string;
  workEndTime: string;
  intervalMin: number;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  validFrom: string | null;
  validTo: string | null;
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

  async getProfile() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        login,
        full_name,
        email,
        phone,
        driver_license_number,
        license_categories
      from driver_api.v_profile
      limit 1
    `)) as unknown as { rows: DriverProfileRow[] };

    const driver = transformToCamelCase(result.rows)[0];
    if (!driver) {
      throw new NotFoundException('Driver profile not found');
    }

    return driver;
  }

  async getScheduleByLogin(date?: string) {
    const driver = await this.getProfile();
    const targetDate = this.parseDate(date);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const tripsResult = (await this.dbService.db.execute(sql`
      select
        id,
        planned_starts_at,
        planned_ends_at,
        actual_starts_at,
        actual_ends_at,
        passenger_count,
        route_id,
        route_number,
        direction as "routeDirection",
        transport_type_id,
        transport_type as "transportTypeName",
        vehicle_id,
        fleet_number
      from driver_api.v_my_schedule
      where (planned_starts_at >= ${startOfDay} and planned_starts_at < ${endOfDay})
         or (actual_starts_at >= ${startOfDay} and actual_starts_at < ${endOfDay})
      order by coalesce(actual_starts_at, planned_starts_at)
    `)) as unknown as {
      rows: (DriverScheduleRow & {
        passengerCount: number;
        plannedStartsAt: Date | null;
        plannedEndsAt: Date | null;
        actualStartsAt: Date | null;
        actualEndsAt: Date | null;
      })[];
    };

    const trips = transformToCamelCase(tripsResult.rows) as Array<
      DriverScheduleRow & {
        passengerCount: number;
        plannedStartsAt: Date | null;
        plannedEndsAt: Date | null;
        actualStartsAt: Date | null;
        actualEndsAt: Date | null;
      }
    >;
    const routeIds = Array.from(new Set(trips.map((trip) => trip.routeId)));
    const stopsByRouteId = new Map<
      number,
      Array<{
        id: number;
        name: string;
        lon: string;
        lat: string;
        distanceToNextKm: number | null;
        minutesToNextStop: number | null;
      }>
    >();

    // Use DB function for ordered stops with timing (replaces orderRouteStops + buildStopsWithTiming)
    for (const routeId of routeIds) {
      const stopsResult = (await this.dbService.db.execute(sql`
        SELECT * FROM guest_api.get_route_stops_with_timing(${routeId})
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

      stopsByRouteId.set(
        routeId,
        stopsResult.rows.map((stop) => ({
          id: stop.stop_id,
          name: stop.stop_name,
          lon: stop.lon,
          lat: stop.lat,
          distanceToNextKm: stop.distance_to_next_km,
          minutesToNextStop: stop.minutes_to_next_stop,
        })),
      );
    }

    const tripsWithStops = trips.map((trip) => {
      const stopsWithIntervals = stopsByRouteId.get(trip.routeId) ?? [];

      // Parse dates (may come as strings from DB)
      const actualStartsAt = trip.actualStartsAt
        ? new Date(trip.actualStartsAt)
        : null;
      const actualEndsAt = trip.actualEndsAt
        ? new Date(trip.actualEndsAt)
        : null;
      const plannedStartsAt = trip.plannedStartsAt
        ? new Date(trip.plannedStartsAt)
        : null;
      const plannedEndsAt = trip.plannedEndsAt
        ? new Date(trip.plannedEndsAt)
        : null;

      // Calculate delay in minutes
      let startDelayMin: number | null = null;
      if (actualStartsAt && plannedStartsAt) {
        startDelayMin = Math.round(
          (actualStartsAt.getTime() - plannedStartsAt.getTime()) / 60000,
        );
      }

      return {
        id: trip.id,
        startsAt: actualStartsAt?.toISOString() ?? null,
        endsAt: actualEndsAt?.toISOString() ?? null,
        plannedStartAt: plannedStartsAt?.toISOString() ?? null,
        plannedEndsAt: plannedEndsAt?.toISOString() ?? null,
        startDelayMin,
        passengerCount: trip.passengerCount,
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

  async getActiveTripByLogin() {
    const now = new Date();
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        starts_at,
        ends_at,
        route_id,
        route_number,
        direction as "routeDirection",
        transport_type_id,
        transport_type as "transportTypeName",
        vehicle_id,
        fleet_number
      from driver_api.v_my_schedule
      where starts_at <= ${now}
        and (ends_at is null or ends_at >= ${now})
      order by starts_at desc
      limit 1
    `)) as unknown as { rows: ActiveTripRow[] };

    const activeTrip = transformToCamelCase(result.rows)[0];
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
    // Use ordered view (replaces orderRouteStops)
    const result = (await this.dbService.db.execute(sql`
      SELECT id, route_id, stop_id, stop_name, lon, lat,
             distance_to_next_km, prev_route_stop_id, next_route_stop_id, sort_order
      FROM guest_api.v_route_stops_ordered
      WHERE route_id = ${routeId}
      ORDER BY sort_order
    `)) as unknown as { rows: OrderedRouteStopRow[] };

    return transformToCamelCase(result.rows);
  }

  async getRoutePoints(payload: RouteLookupDto) {
    const routeId = await this.resolveRouteId(payload);
    // Use ordered view (replaces orderRoutePoints)
    const result = (await this.dbService.db.execute(sql`
      SELECT id, route_id, lon, lat, prev_route_point_id, next_route_point_id, sort_order
      FROM guest_api.v_route_points_ordered
      WHERE route_id = ${routeId}
      ORDER BY sort_order
    `)) as unknown as { rows: RoutePointRow[] };

    return transformToCamelCase(result.rows);
  }

  async startTrip(payload: StartTripDto) {
    const startedAt = payload.startedAt ?? new Date();

    // Новий API: приймає tripId (необов'язково) та startedAt
    const result = (await this.dbService.db.execute(sql`
      select driver_api.start_trip(
        ${payload.tripId ?? null}::bigint,
        ${startedAt}::timestamp
      ) as "tripId"
    `)) as unknown as { rows: Array<{ tripId: number }> };

    return result.rows[0] ?? { tripId: null };
  }

  async getScheduledTrips() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        route_id,
        route_number,
        direction,
        transport_type,
        vehicle_id,
        fleet_number,
        planned_starts_at,
        planned_ends_at,
        status
      from driver_api.v_my_scheduled_trips
      order by planned_starts_at
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeId: number;
        routeNumber: string;
        direction: string;
        transportType: string;
        vehicleId: number;
        fleetNumber: string;
        plannedStartsAt: Date;
        plannedEndsAt: Date | null;
        status: string;
      }>;
    };

    return transformToCamelCase(result.rows);
  }

  async getActiveTrip() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        route_id,
        route_number,
        direction,
        transport_type,
        vehicle_id,
        fleet_number,
        planned_starts_at,
        actual_starts_at,
        passenger_count,
        start_delay_min
      from driver_api.v_my_active_trip
      limit 1
    `)) as unknown as {
      rows: Array<{
        id: number;
        routeId: number;
        routeNumber: string;
        direction: string;
        transportType: string;
        vehicleId: number;
        fleetNumber: string;
        plannedStartsAt: Date;
        actualStartsAt: Date;
        passengerCount: number;
        startDelayMin: number | null;
      }>;
    };

    const activeTrip = transformToCamelCase(result.rows)[0];
    return activeTrip ?? null;
  }

  async finishTrip(payload: FinishTripDto) {
    const endedAt = payload.endedAt ?? new Date();
    const result = (await this.dbService.db.execute(sql`
      select driver_api.finish_trip(${endedAt}) as "tripId"
    `)) as unknown as { rows: Array<{ tripId: number }> };

    return result.rows[0] ?? { tripId: null };
  }

  async setPassengerCount(payload: PassengerCountDto) {
    await this.dbService.db.execute(sql`
      select driver_api.update_passengers(${payload.tripId}::bigint, ${payload.passengerCount}::integer)
    `);

    return { ok: true };
  }

  async logGps(payload: GpsLogDto) {
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
      // Fallback if chain is broken
      return rows.sort((a, b) => a.id - b.id);
    }

    return ordered;
  }

  private buildStopsWithTiming(
    stops: OrderedRouteStopRow[],
    routePoints: RoutePointRow[],
  ) {
    const points = routePoints ?? [];
    const pointDistances =
      points.length >= 2 ? this.buildPointDistances(points) : null;
    const stopPointIndexes = pointDistances
      ? this.mapStopsToPointIndexes(stops, points)
      : new Map<number, number>();
    const startIndex =
      stops.length > 0 ? stopPointIndexes.get(stops[0].id) : undefined;
    let cumulativeMinutes = 0;

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

  private mapStopsToPointIndexes(
    stops: OrderedRouteStopRow[],
    points: RoutePointRow[],
  ) {
    const map = new Map<number, number>();
    for (const stop of stops) {
      const idx = this.findNearestPointIndex(stop, points);
      if (idx != null) {
        map.set(stop.id, idx);
      }
    }
    return map;
  }

  private findNearestPointIndex(
    stop: OrderedRouteStopRow,
    points: RoutePointRow[],
  ) {
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

  private async findScheduleByRouteId(
    routeId: number,
  ): Promise<ScheduleRow | null> {
    const result = (await this.dbService.db.execute(sql`
      select
        work_start_time,
        work_end_time,
        interval_min,
        monday,
        tuesday,
        wednesday,
        thursday,
        friday,
        saturday,
        sunday,
        valid_from,
        valid_to
      from guest_api.v_schedules
      where route_id = ${routeId}
      limit 1
    `)) as unknown as { rows: ScheduleRow[] };

    const schedules = transformToCamelCase(result.rows);
    return schedules[0] ?? null;
  }

  private roundTo1(value: number) {
    return Math.round(value * 10) / 10;
  }

  private parseTimeToMinutes(time: string) {
    const parts = time.split(':').map(Number);
    if (parts.length < 2 || parts.some((value) => Number.isNaN(value))) {
      return Number.NaN;
    }
    const [hours, minutes, seconds = 0] = parts;
    return hours * 60 + minutes + seconds / 60;
  }

  private buildDateWithMinutes(base: Date, minutes: number) {
    const date = new Date(base);
    date.setHours(0, 0, 0, 0);
    date.setMinutes(minutes);
    return date;
  }

  private buildPlannedDepartures(schedule: ScheduleRow, targetDate: Date) {
    const startMin = this.parseTimeToMinutes(schedule.workStartTime);
    const endMin = this.parseTimeToMinutes(schedule.workEndTime);
    if (!Number.isFinite(startMin) || !Number.isFinite(endMin)) {
      return [];
    }

    const plannedStartAt = this.buildDateWithMinutes(targetDate, startMin);
    let plannedEndAt = this.buildDateWithMinutes(targetDate, endMin);
    if (endMin < startMin) {
      plannedEndAt = new Date(plannedEndAt.getTime() + 24 * 60 * 60 * 1000);
    }

    const intervalMin = schedule.intervalMin;
    if (!intervalMin || intervalMin <= 0) {
      return [];
    }

    const planned: Date[] = [];
    let current = plannedStartAt;

    while (current <= plannedEndAt) {
      planned.push(current);
      current = new Date(current.getTime() + intervalMin * 60 * 1000);
    }

    return planned;
  }

  private buildTripPlanMap(
    trips: Array<DriverScheduleRow & { passengerCount: number }>,
    plannedDepartures: Date[],
    routeDurationMin: number,
  ) {
    const map = new Map<
      number,
      {
        plannedStartAt: string | null;
        plannedEndsAt: string | null;
        startDelayMin: number | null;
      }
    >();
    if (!plannedDepartures.length) {
      return map;
    }

    for (const trip of trips) {
      if (!(trip.startsAt instanceof Date)) {
        map.set(trip.id, {
          plannedStartAt: null,
          plannedEndsAt: null,
          startDelayMin: null,
        });
        continue;
      }
      let best: Date | null = null;
      let bestDiff = Number.POSITIVE_INFINITY;

      for (const planned of plannedDepartures) {
        const diff = Math.abs(trip.startsAt.getTime() - planned.getTime());
        if (diff < bestDiff) {
          bestDiff = diff;
          best = planned;
        }
      }

      const plannedEndsAt = best
        ? new Date(best.getTime() + routeDurationMin * 60 * 1000)
        : null;

      map.set(trip.id, {
        plannedStartAt: best ? best.toISOString() : null,
        plannedEndsAt: plannedEndsAt ? plannedEndsAt.toISOString() : null,
        startDelayMin: best
          ? Math.round((trip.startsAt.getTime() - best.getTime()) / 60000)
          : null,
      });
    }

    return map;
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
