import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { RouteLookupDto } from './dto/route-lookup.dto';
import { RoutesBetweenDto } from './dto/routes-between.dto';
import { RouteScheduleDto } from './dto/route-schedule.dto';
import { StopsNearDto } from './dto/stops-near.dto';

const AVERAGE_SPEED_KMH = 25;

type StopNearRow = {
  id: number;
  name: string;
  lon: string;
  lat: string;
  distanceM: number;
};

type RouteByStopRow = {
  routeId: number;
  routeNumber: string;
  transportTypeId: number;
  transportType: string;
  direction: string;
  intervalMin: number | null;
};

type RouteRow = {
  id: number;
  number: string;
  direction: string;
  transportTypeId: number;
  transportType: string;
};

type TransportTypeRow = {
  id: number;
  name: string;
};

type RouteStopRow = {
  id: number;
  routeId: number;
  stopId: number;
  stopName: string;
  lon: string;
  lat: string;
  prevRouteStopId: number | null;
  nextRouteStopId: number | null;
  distanceToNextKm: string | null;
};

type RoutePointRow = {
  id: number;
  routeId: number;
  lon: string;
  lat: string;
  prevRoutePointId: number | null;
  nextRoutePointId: number | null;
};

type ScheduleRow = {
  id: number;
  routeId: number;
  workStartTime: string;
  workEndTime: string;
  intervalMin: number;
};

@Injectable()
export class CtGuestService {
  constructor(private readonly dbService: DbService) {}

  async listTransportTypes() {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        name as "name"
      from guest_api.v_transport_types
      order by id
    `)) as unknown as { rows: TransportTypeRow[] };

    return result.rows;
  }

  async listRoutes(transportTypeId?: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        number as "number",
        direction as "direction",
        transport_type_id as "transportTypeId",
        transport_type as "transportType"
      from guest_api.v_routes
      ${transportTypeId ? sql`where transport_type_id = ${transportTypeId}` : sql``}
      order by number
    `)) as unknown as { rows: RouteRow[] };

    return result.rows;
  }

  getStopsNear(query: StopsNearDto) {
    const radius = query.radius ?? 500;
    const limit = query.limit ?? 10;
    return this.findStopsNear(query.lon, query.lat, radius, limit);
  }

  async getRoutesByStop(stopId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        rs.route_id as "routeId",
        r.number as "routeNumber",
        r.transport_type_id as "transportTypeId",
        r.transport_type as "transportType",
        r.direction as "direction",
        sc.interval_min as "intervalMin"
      from guest_api.v_route_stops rs
      join guest_api.v_routes r on r.id = rs.route_id
      left join guest_api.v_schedules sc on sc.route_id = rs.route_id
      where rs.stop_id = ${stopId}
    `)) as unknown as { rows: RouteByStopRow[] };

    if (result.rows.length === 0) {
      throw new NotFoundException(`No routes found for stop ${stopId}`);
    }

    return result.rows.map((route) => ({
      routeId: route.routeId,
      routeNumber: route.routeNumber,
      transportTypeId: route.transportTypeId,
      transportType: route.transportType,
      direction: route.direction,
      approxArrivalMin: route.intervalMin,
    }));
  }

  async getRouteStops(payload: RouteLookupDto) {
    const routeId = await this.resolveRouteId(payload);
    const rows = await this.findRouteStops(routeId);
    return this.orderRouteStops(rows).map((stop) => ({
      id: stop.stopId,
      name: stop.stopName,
      lon: stop.lon,
      lat: stop.lat,
      distanceToNextKm: stop.distanceToNextKm
        ? Number(stop.distanceToNextKm)
        : null,
    }));
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

  async getRoutesBetween(payload: RoutesBetweenDto) {
    const radius = payload.radius ?? 500;
    const [stopA] = await this.findStopsNear(
      payload.lonA,
      payload.latA,
      radius,
      1,
    );
    const [stopB] = await this.findStopsNear(
      payload.lonB,
      payload.latB,
      radius,
      1,
    );

    if (!stopA || !stopB) {
      throw new NotFoundException('Nearest stops not found for given points');
    }

    const routesA = await this.getRoutesByStop(stopA.id);
    const routesB = await this.getRoutesByStop(stopB.id);

    const routesMap = new Map(routesA.map((route) => [route.routeId, route]));

    const candidates = routesB
      .map((route) => routesMap.get(route.routeId))
      .filter((route): route is NonNullable<typeof route> => Boolean(route));

    const results = [] as Array<{
      routeId: number;
      routeNumber: string;
      transportTypeId: number;
      transportType: string;
      direction: string;
      fromStopId: number;
      toStopId: number;
      distanceKm: number | null;
      travelMinutes: number | null;
    }>;

    for (const route of candidates) {
      const orderedStops = this.orderRouteStops(
        await this.findRouteStops(route.routeId),
      );
      const indexA = orderedStops.findIndex((stop) => stop.stopId === stopA.id);
      const indexB = orderedStops.findIndex((stop) => stop.stopId === stopB.id);

      if (indexA === -1 || indexB === -1 || indexA >= indexB) {
        continue;
      }

      const segment = orderedStops.slice(indexA, indexB);
      const hasMissingDistance = segment.some(
        (stop) => stop.distanceToNextKm === null,
      );

      let distanceKm: number | null = null;
      let travelMinutes: number | null = null;

      if (!hasMissingDistance) {
        distanceKm = segment.reduce(
          (sum, stop) => sum + Number(stop.distanceToNextKm),
          0,
        );
        travelMinutes = this.roundTo1((distanceKm / AVERAGE_SPEED_KMH) * 60);
      }

      results.push({
        routeId: route.routeId,
        routeNumber: route.routeNumber,
        transportTypeId: route.transportTypeId,
        transportType: route.transportType,
        direction: route.direction,
        fromStopId: stopA.id,
        toStopId: stopB.id,
        distanceKm,
        travelMinutes,
      });
    }

    if (results.length === 0) {
      throw new NotFoundException('No routes found between these stops');
    }

    return {
      fromStop: stopA,
      toStop: stopB,
      routes: results,
    };
  }

  async getSchedule(payload: RouteScheduleDto) {
    const routeId = await this.resolveRouteId(payload);
    const schedule = await this.findScheduleByRouteId(routeId);

    if (!schedule) {
      throw new NotFoundException(`Schedule for route ${routeId} not found`);
    }

    const route = await this.findRouteById(routeId);
    if (!route) {
      throw new NotFoundException(`Route ${routeId} not found`);
    }

    let stopOffsetMin: number | null = null;
    let stopName: string | null = null;

    if (payload.stopId) {
      const orderedStops = this.orderRouteStops(
        await this.findRouteStops(routeId),
      );
      const index = orderedStops.findIndex(
        (stop) => stop.stopId === payload.stopId,
      );
      if (index === -1) {
        throw new NotFoundException(
          `Stop ${payload.stopId} not found for route ${routeId}`,
        );
      }

      stopName = orderedStops[index].stopName;
      const segment = orderedStops.slice(0, index);
      const hasMissingDistance = segment.some(
        (stop) => stop.distanceToNextKm === null,
      );
      if (!hasMissingDistance) {
        const distanceKm = segment.reduce(
          (sum, stop) => sum + Number(stop.distanceToNextKm ?? 0),
          0,
        );
        stopOffsetMin = this.roundTo1((distanceKm / AVERAGE_SPEED_KMH) * 60);
      }
    }

    const departures = this.buildDepartureTimes(
      schedule.workStartTime,
      schedule.workEndTime,
      schedule.intervalMin,
    );
    const arrivals =
      stopOffsetMin !== null
        ? departures.map((time) => this.addMinutes(time, stopOffsetMin))
        : [];

    return {
      route: {
        id: route.id,
        number: route.number,
        transportTypeId: route.transportTypeId,
        transportType: route.transportType,
        direction: route.direction,
      },
      stop: payload.stopId
        ? {
            id: payload.stopId,
            name: stopName,
            offsetMin: stopOffsetMin,
          }
        : null,
      schedule: {
        workStartTime: schedule.workStartTime,
        workEndTime: schedule.workEndTime,
        intervalMin: schedule.intervalMin,
      },
      departures,
      arrivals,
    };
  }

  private async resolveRouteId(payload: RouteLookupDto) {
    if (payload.routeId) {
      return payload.routeId;
    }

    if (!payload.routeNumber || !payload.transportTypeId) {
      throw new BadRequestException(
        'routeId or routeNumber + transportTypeId is required',
      );
    }

    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        number as "number",
        direction as "direction",
        transport_type_id as "transportTypeId",
        transport_type as "transportType"
      from guest_api.v_routes
      where number = ${payload.routeNumber}
        and transport_type_id = ${payload.transportTypeId}
        and direction = ${payload.direction ?? 'forward'}
      limit 1
    `)) as unknown as { rows: RouteRow[] };

    const route = result.rows[0];

    if (!route) {
      throw new NotFoundException(
        `Route ${payload.routeNumber} (${payload.transportTypeId}) not found`,
      );
    }

    return route.id;
  }

  private roundTo1(value: number) {
    return Math.round(value * 10) / 10;
  }

  private async findStopsNear(
    lon: number,
    lat: number,
    radius: number,
    limit: number,
  ) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        name as "name",
        lon as "lon",
        lat as "lat",
        distance_m as "distanceM"
      from guest_api.find_nearby_stops(${lon}, ${lat}, ${radius}, ${limit})
    `)) as unknown as { rows: StopNearRow[] };

    return result.rows;
  }

  private async findRouteStops(routeId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        route_id as "routeId",
        stop_id as "stopId",
        stop_name as "stopName",
        lon as "lon",
        lat as "lat",
        prev_route_stop_id as "prevRouteStopId",
        next_route_stop_id as "nextRouteStopId",
        distance_to_next_km as "distanceToNextKm"
      from guest_api.v_route_stops
      where route_id = ${routeId}
    `)) as unknown as { rows: RouteStopRow[] };

    return result.rows;
  }

  private orderRouteStops(rows: RouteStopRow[]) {
    if (rows.length === 0) {
      return rows;
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    const start = rows.find((row) => row.prevRouteStopId === null);

    if (!start) {
      return rows.sort((a, b) => a.id - b.id);
    }

    const ordered: RouteStopRow[] = [];
    const visited = new Set<number>();
    let current: RouteStopRow | undefined = start;

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
    `)) as unknown as { rows: ScheduleRow[] };

    return result.rows[0] ?? null;
  }

  private async findRouteById(routeId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        number as "number",
        direction as "direction",
        transport_type_id as "transportTypeId",
        transport_type as "transportType"
      from guest_api.v_routes
      where id = ${routeId}
      limit 1
    `)) as unknown as { rows: RouteRow[] };

    return result.rows[0] ?? null;
  }

  private parseTimeToMinutes(value: string) {
    const [hours, minutes] = value.split(':').map((part) => Number(part));
    return hours * 60 + minutes;
  }

  private formatMinutes(minutesTotal: number) {
    const hours = Math.floor(minutesTotal / 60) % 24;
    const minutes = minutesTotal % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}`;
  }

  private buildDepartureTimes(
    startTime: string,
    endTime: string,
    intervalMin: number,
  ) {
    const startMinutes = this.parseTimeToMinutes(startTime);
    const endMinutes = this.parseTimeToMinutes(endTime);
    if (intervalMin <= 0 || endMinutes < startMinutes) {
      return [];
    }
    const result: string[] = [];
    for (let time = startMinutes; time <= endMinutes; time += intervalMin) {
      result.push(this.formatMinutes(time));
    }
    return result;
  }

  private addMinutes(time: string, offsetMin: number) {
    const baseMinutes = this.parseTimeToMinutes(time);
    return this.formatMinutes(baseMinutes + Math.round(offsetMin));
  }
}
