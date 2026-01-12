import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { transformToCamelCase } from '../../common/utils/transform-to-camel-case';
import { DbService } from '../../db/db.service';
import { RouteLookupDto } from './dto/route-lookup.dto';
import { RoutesBetweenDto } from './dto/routes-between.dto';
import { RouteScheduleDto } from './dto/route-schedule.dto';
import { StopsNearDto } from './dto/stops-near.dto';
import { CreateGuestComplaintDto } from './dto/create-complaint.dto';

const AVERAGE_SPEED_KMH = 25;

type StopNearRow = {
  id: number;
  name: string;
  lon: string;
  lat: string;
  distanceM: number;
};

type StopRow = {
  id: number;
  name: string;
  lon: string;
  lat: string;
};

type RouteByStopRow = {
  routeId: number;
  routeNumber: string;
  transportTypeId: number;
  transportTypeName: string;
  direction: string;
  intervalMin: number | null;
};

type RouteRow = {
  id: number;
  number: string;
  direction: string;
  transportTypeId: number;
  transportTypeName: string;
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

type RouteGeometryRow = {
  routeId: number;
  number: string;
  transportType: string;
  direction: string;
  geometry: any;
};

type StopGeometryRow = {
  id: number;
  name: string;
  geometry: unknown;
};

type ScheduleRow = {
  routeId: number;
  workStartTime: string;
  workEndTime: string;
  intervalMin: number;
};

type PgrPathRow = {
  seq: number;
  node: number;
  edge: number;
  cost: number | null;
  aggCost: number | null;
  routeId: number | null;
  stopId: number | null;
  pathId: number;
};

type PlannedSegment = {
  routeId: number;
  routeNumber: string;
  transportTypeName: string;
  transportTypeId: number;
  direction: string;
  fromStop: {
    id: number;
    name: string;
    lon: number;
    lat: number;
  };
  toStop: {
    id: number;
    name: string;
    lon: number;
    lat: number;
  };
  distanceKm: number;
  travelTimeMin: number;
  departureTime: string;
  arrivalTime: string;
};

type PlannedRouteOption = {
  totalTimeMin: number;
  totalDistanceKm: number;
  transferCount: number;
  segments: PlannedSegment[];
  transfer?: {
    stopId: number;
    stopName: string;
    lon: number;
    lat: number;
    waitTimeMin: number;
  };
  transfers?: Array<{
    stopId: number;
    stopName: string;
    lon: number;
    lat: number;
    waitTimeMin: number;
  }>;
};

@Injectable()
export class CtGuestService {
  constructor(private readonly dbService: DbService) {}

  async listTransportTypes() {
    const result = (await this.dbService.db.execute(sql`
      select id, name from guest_api.v_transport_types
    `)) as unknown as { rows: TransportTypeRow[] };

    return result.rows;
  }

  async listRoutes(transportTypeId?: number) {
    const query = transportTypeId
      ? sql`select id, number, direction, transport_type_id, transport_type_name from guest_api.v_routes where transport_type_id = ${transportTypeId}`
      : sql`select id, number, direction, transport_type_id, transport_type_name from guest_api.v_routes`;

    const result = (await this.dbService.db.execute(query)) as unknown as {
      rows: RouteRow[];
    };

    return result.rows;
  }

  async getStopsNear(payload: StopsNearDto) {
    return this.findStopsNear(
      payload.lon,
      payload.lat,
      payload.radius ?? 500,
      payload.limit ?? 10,
    );
  }

  async getRoutesByStop(stopId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        rs.route_id,
        r.number as "routeNumber",
        r.transport_type_id,
        tt.name as "transportTypeName",
        r.direction,
        s.interval_min
      from guest_api.v_route_stops rs
      join guest_api.v_routes r on r.id = rs.route_id
      join guest_api.v_transport_types tt on tt.id = r.transport_type_id
      left join guest_api.v_schedules s on s.route_id = r.id
      where rs.stop_id = ${stopId}
    `)) as unknown as { rows: RouteByStopRow[] };
    const routesByStop = transformToCamelCase(result.rows) as RouteByStopRow[];

    // Calculate estimated arrival time for each route
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const enrichedResults = await Promise.all(
      routesByStop.map(async (route) => {
        let nextArrivalMin: number | null = null;

        try {
          // Get ordered stops for this route
          const orderedStops = this.orderRouteStops(
            await this.findRouteStops(route.routeId),
          );

          // Find position of this stop in the route
          const stopIndex = orderedStops.findIndex(
            (stop) => stop.stopId === stopId,
          );

          if (stopIndex !== -1) {
            // Calculate travel time from start to this stop
            const segment = orderedStops.slice(0, stopIndex);
            const hasMissingDistance = segment.some(
              (stop) => stop.distanceToNextKm === null,
            );

            if (!hasMissingDistance) {
              const distanceKm = segment.reduce(
                (sum, stop) => sum + Number(stop.distanceToNextKm ?? 0),
                0,
              );
              const travelTimeMin = (distanceKm / AVERAGE_SPEED_KMH) * 60;

              // Get schedule for this route
              const schedule = await this.findScheduleByRouteId(route.routeId);

              if (schedule) {
                const startMin = this.parseTimeToMinutes(
                  schedule.workStartTime,
                );
                const endMin = this.parseTimeToMinutes(schedule.workEndTime);
                const intervalMin = schedule.intervalMin;

                // Find next departure from start
                let nextDeparture = startMin;
                while (
                  nextDeparture < currentMinutes &&
                  nextDeparture < endMin
                ) {
                  nextDeparture += intervalMin;
                }

                if (nextDeparture <= endMin) {
                  // Calculate arrival at this stop
                  const arrivalAtStop = nextDeparture + travelTimeMin;
                  nextArrivalMin = Math.round(arrivalAtStop - currentMinutes);

                  // If negative, try next departure
                  if (
                    nextArrivalMin < 0 &&
                    nextDeparture + intervalMin <= endMin
                  ) {
                    nextArrivalMin = Math.round(
                      nextDeparture +
                        intervalMin +
                        travelTimeMin -
                        currentMinutes,
                    );
                  }
                }
              }
            }
          }
        } catch (error) {
          console.error(
            `Error calculating arrival for route ${route.routeId}:`,
            error,
          );
        }

        return {
          ...route,
          nextArrivalMin,
        };
      }),
    );

    return enrichedResults;
  }

  async getRouteStops(payload: RouteLookupDto) {
    const routeId = await this.resolveRouteId(payload);
    const rows = await this.findRouteStops(routeId);
    return this.orderRouteStops(rows);
  }

  async getRoutePoints(payload: RouteLookupDto) {
    const routeId = await this.resolveRouteId(payload);
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        route_id,
        lon,
        lat,
        prev_route_point_id,
        next_route_point_id
      from guest_api.v_route_points
      where route_id = ${routeId}
    `)) as unknown as { rows: RoutePointRow[] };

    return transformToCamelCase(result.rows) as RoutePointRow[];
  }

  async getRouteGeometry(payload: RouteLookupDto) {
    const routeId = await this.resolveRouteId(payload);
    const result = (await this.dbService.db.execute(sql`
      select
        route_id,
        number,
        transport_type,
        direction,
        geometry
      from guest_api.v_route_geometries
      where route_id = ${routeId}
    `)) as unknown as { rows: RouteGeometryRow[] };

    const geometries = transformToCamelCase(result.rows) as RouteGeometryRow[];
    return geometries[0] ?? null;
  }

  async getAllRouteGeometries(transportTypeId?: number) {
    const query = transportTypeId
      ? sql`
      select
        g.route_id,
        g.number,
        r.transport_type_id,
        g.transport_type,
        g.direction,
        g.geometry
      from guest_api.v_route_geometries g
      join guest_api.v_routes r on r.id = g.route_id
      where r.transport_type_id = ${transportTypeId}
    `
      : sql`
      select
        g.route_id,
        g.number,
        r.transport_type_id,
        g.transport_type,
        g.direction,
        g.geometry
      from guest_api.v_route_geometries g
      join guest_api.v_routes r on r.id = g.route_id
    `;

    const result = (await this.dbService.db.execute(query)) as unknown as {
      rows: RouteGeometryRow[];
    };

    return transformToCamelCase(result.rows) as RouteGeometryRow[];
  }

  async getStopGeometries() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        name,
        geometry
      from guest_api.v_stop_geometries
    `)) as unknown as { rows: StopGeometryRow[] };

    return transformToCamelCase(result.rows) as StopGeometryRow[];
  }

  async submitComplaint(payload: CreateGuestComplaintDto) {
    await this.dbService.db.execute(sql`
      select guest_api.submit_complaint(
        ${payload.type},
        ${payload.message},
        ${payload.contactInfo ?? null},
        ${payload.routeNumber ?? null},
        ${payload.transportType ?? null},
        ${payload.vehicleNumber ?? null}
      )
    `);
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
      transportTypeName: string;
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
        transportTypeName: route.transportTypeName,
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

  async getRouteGeometryBetweenStops(
    routeId: number,
    fromStopId: number,
    toStopId: number,
  ) {
    // Get ordered stops for this route
    const orderedStops = this.orderRouteStops(
      await this.findRouteStops(routeId),
    );

    let fromIndex = orderedStops.findIndex(
      (stop) => stop.stopId === fromStopId,
    );
    let toIndex = orderedStops.findIndex((stop) => stop.stopId === toStopId);

    if (fromIndex === -1 || toIndex === -1) {
      const fallback = await this.findClosestStopsOnRoute(
        orderedStops,
        fromStopId,
        toStopId,
      );
      fromIndex = fallback.fromIndex;
      toIndex = fallback.toIndex;
    }

    if (fromIndex === -1 || toIndex === -1) {
      throw new NotFoundException(
        `One or both stops not found on route ${routeId}`,
      );
    }

    if (fromIndex > toIndex) {
      const temp = fromIndex;
      fromIndex = toIndex;
      toIndex = temp;
    }

    // Get all route points
    const allPoints = (await this.dbService.db.execute(sql`
      select
        id,
        route_id,
        lon,
        lat,
        prev_route_point_id,
        next_route_point_id
      from guest_api.v_route_points
      where route_id = ${routeId}
    `)) as unknown as { rows: RoutePointRow[] };

    const points = transformToCamelCase(allPoints.rows) as RoutePointRow[];

    if (points.length === 0) {
      throw new NotFoundException(`No route points found for route ${routeId}`);
    }

    // Order route points using linked list (same logic as orderRouteStops)
    const orderedPoints = this.orderRoutePoints(points);

    // Get coordinates of from and to stops
    const fromStop = orderedStops[fromIndex];
    const toStop = orderedStops[toIndex];

    const fromCoords = { lon: Number(fromStop.lon), lat: Number(fromStop.lat) };
    const toCoords = { lon: Number(toStop.lon), lat: Number(toStop.lat) };

    // Find closest route point indices in the ordered list
    let fromPointIndex = 0;
    let toPointIndex = orderedPoints.length - 1;
    let minFromDistance = Number.POSITIVE_INFINITY;
    let minToDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < orderedPoints.length; i++) {
      const point = orderedPoints[i];
      const pointLat = Number(point.lat);
      const pointLon = Number(point.lon);

      const fromDist = this.getDistance(
        fromCoords.lat,
        fromCoords.lon,
        pointLat,
        pointLon,
      );
      const toDist = this.getDistance(
        toCoords.lat,
        toCoords.lon,
        pointLat,
        pointLon,
      );

      if (fromDist < minFromDistance) {
        minFromDistance = fromDist;
        fromPointIndex = i;
      }
      if (toDist < minToDistance) {
        minToDistance = toDist;
        toPointIndex = i;
      }
    }

    // Ensure correct order (from before to in the sequence)
    if (fromPointIndex > toPointIndex) {
      const temp = fromPointIndex;
      fromPointIndex = toPointIndex;
      toPointIndex = temp;
    }

    // Extract segment from ordered points
    const segmentPoints = orderedPoints.slice(fromPointIndex, toPointIndex + 1);

    // Convert to coordinates array
    const coordinates: [number, number][] = segmentPoints.map((p) => [
      Number(p.lon),
      Number(p.lat),
    ]);

    // Always start from actual fromStop coordinates
    const firstCoord = coordinates[0];
    if (
      !firstCoord ||
      Math.abs(firstCoord[0] - fromCoords.lon) > 0.0001 ||
      Math.abs(firstCoord[1] - fromCoords.lat) > 0.0001
    ) {
      coordinates.unshift([fromCoords.lon, fromCoords.lat]);
    }

    // Always end at actual toStop coordinates
    const lastCoord = coordinates[coordinates.length - 1];
    if (
      !lastCoord ||
      Math.abs(lastCoord[0] - toCoords.lon) > 0.0001 ||
      Math.abs(lastCoord[1] - toCoords.lat) > 0.0001
    ) {
      coordinates.push([toCoords.lon, toCoords.lat]);
    }

    // Ensure we have at least 2 points
    if (coordinates.length < 2) {
      return {
        type: 'LineString' as const,
        coordinates: [
          [fromCoords.lon, fromCoords.lat],
          [toCoords.lon, toCoords.lat],
        ],
      };
    }

    return {
      type: 'LineString' as const,
      coordinates,
    };
  }

  private orderRoutePoints(rows: RoutePointRow[]): RoutePointRow[] {
    if (rows.length === 0) {
      return rows;
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    const start = rows.find((row) => row.prevRoutePointId === null);

    if (!start) {
      // Fallback: sort by id if no clear start point
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

    // If we couldn't traverse all points, return what we have
    // (there might be orphaned points due to data issues)
    if (ordered.length < rows.length) {
      // Add any missed points at the end (sorted by id)
      const orderedIds = new Set(ordered.map((p) => p.id));
      const missed = rows
        .filter((p) => !orderedIds.has(p.id))
        .sort((a, b) => a.id - b.id);
      ordered.push(...missed);
    }

    return ordered;
  }

  private async findClosestStopsOnRoute(
    orderedStops: RouteStopRow[],
    fromStopId: number,
    toStopId: number,
  ) {
    const [fromStop, toStop] = await Promise.all([
      this.findStopCoords(fromStopId),
      this.findStopCoords(toStopId),
    ]);

    const fromIndex =
      fromStop != null ? this.findClosestStopIndex(orderedStops, fromStop) : -1;
    const toIndex =
      toStop != null ? this.findClosestStopIndex(orderedStops, toStop) : -1;

    return { fromIndex, toIndex };
  }

  private async findStopCoords(stopId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        lon,
        lat
      from guest_api.v_stops
      where id = ${stopId}
      limit 1
    `)) as unknown as {
      rows: Array<{ id: number; lon: string; lat: string }>;
    };

    const stop = result.rows[0];
    if (!stop) {
      return null;
    }

    return {
      id: stop.id,
      lon: Number(stop.lon),
      lat: Number(stop.lat),
    };
  }

  private findClosestStopIndex(
    orderedStops: RouteStopRow[],
    coords: { lon: number; lat: number },
  ) {
    let closestIndex = -1;
    let minDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < orderedStops.length; i += 1) {
      const stop = orderedStops[i];
      const distance = this.getDistance(
        coords.lat,
        coords.lon,
        Number(stop.lat),
        Number(stop.lon),
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  }

  private getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Earth radius in km
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
        transportTypeName: route.transportTypeName,
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
        id,
        number,
        direction,
        transport_type_id,
        transport_type_name
      from guest_api.v_routes
      where number = ${payload.routeNumber}
        and transport_type_id = ${payload.transportTypeId}
        and direction = ${payload.direction ?? 'forward'}
      limit 1
    `)) as unknown as { rows: RouteRow[] };

    const route = (transformToCamelCase(result.rows) as RouteRow[])[0];

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
        id,
        name,
        lon,
        lat,
        distance_m
      from guest_api.find_nearby_stops(${lon}, ${lat}, ${radius}, ${limit})
    `)) as unknown as { rows: StopNearRow[] };

    return transformToCamelCase(result.rows) as StopNearRow[];
  }

  private async findStopsByIds(stopIds: number[]) {
    if (stopIds.length === 0) {
      return [];
    }
    const stopParams = stopIds.map((id) => sql`${id}`);
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        name,
        lon,
        lat
      from guest_api.v_stops
      where id in (${sql.join(stopParams, sql`, `)})
    `)) as unknown as { rows: StopRow[] };

    return transformToCamelCase(result.rows) as StopRow[];
  }

  private async findRoutesByIds(routeIds: number[]) {
    if (routeIds.length === 0) {
      return [];
    }
    const routeParams = routeIds.map((id) => sql`${id}`);
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        number,
        direction,
        transport_type_id,
        transport_type_name
      from guest_api.v_routes
      where id in (${sql.join(routeParams, sql`, `)})
    `)) as unknown as { rows: RouteRow[] };

    return transformToCamelCase(result.rows) as RouteRow[];
  }

  private async findPgRoutingPath(
    startStopIds: number[],
    endStopIds: number[],
    transferPenaltyMin: number,
    maxPaths: number,
  ) {
    if (startStopIds.length === 0 || endStopIds.length === 0) {
      return [];
    }
    const startParams = startStopIds.map((id) => sql`${id}`);
    const endParams = endStopIds.map((id) => sql`${id}`);
    const startArray = sql`ARRAY[${sql.join(startParams, sql`, `)}]`;
    const endArray = sql`ARRAY[${sql.join(endParams, sql`, `)}]`;

    const result = (await this.dbService.db.execute(sql`
      select
        seq,
        node,
        edge,
        cost,
        agg_cost,
        route_id,
        stop_id,
        path_id
      from guest_api.plan_route_pgrouting(
        ${startArray}::bigint[],
        ${endArray}::bigint[],
        ${transferPenaltyMin}::integer,
        ${maxPaths}::integer
      )
      order by path_id, seq
    `)) as unknown as { rows: PgrPathRow[] };

    return transformToCamelCase(result.rows) as PgrPathRow[];
  }

  private buildRouteOptionFromPath(
    pathRows: PgrPathRow[],
    stopsById: Map<number, StopRow>,
    routesById: Map<number, RouteRow>,
    currentMinutes: number,
    transferPenaltyMin: number,
  ): PlannedRouteOption | null {
    const segments: PlannedSegment[] = [];
    const transfers: NonNullable<PlannedRouteOption['transfers']> = [];
    let currentSegment: PlannedSegment | null = null;
    let currentRouteId: number | null = null;
    let segmentDistanceKm = 0;
    let segmentTravelMin = 0;
    let accumulatedMinutes = 0;

    const finalizeSegment = () => {
      if (!currentSegment) return;
      currentSegment.distanceKm = this.roundTo1(segmentDistanceKm);
      currentSegment.travelTimeMin = this.roundTo1(segmentTravelMin);
      currentSegment.arrivalTime = this.formatMinutes(
        currentMinutes + accumulatedMinutes,
      );
      segments.push(currentSegment);
      currentSegment = null;
      currentRouteId = null;
      segmentDistanceKm = 0;
      segmentTravelMin = 0;
    };

    for (let i = 1; i < pathRows.length; i += 1) {
      const prev = pathRows[i - 1];
      const current = pathRows[i];
      const edgeCost = Number(current.cost ?? 0);
      const edgeRouteId = current.routeId;
      const fromStopId = prev.stopId;
      const toStopId = current.stopId;

      if (!fromStopId || !toStopId) {
        continue;
      }

      if (edgeRouteId == null) {
        // FIX: Оновити toStop до зупинки пересадки (toStopId) перед фіналізацією
        // toStopId - це фізична зупинка пересадки, fromStopId - попередня зупинка
        if (currentSegment && toStopId) {
          const transferStop = stopsById.get(toStopId);
          if (transferStop) {
            currentSegment.toStop = {
              id: transferStop.id,
              name: transferStop.name,
              lon: Number(transferStop.lon),
              lat: Number(transferStop.lat),
            };
          }
        }
        finalizeSegment();
        accumulatedMinutes += edgeCost;
        const transferStop = stopsById.get(toStopId);
        if (transferStop) {
          transfers.push({
            stopId: transferStop.id,
            stopName: transferStop.name,
            lon: Number(transferStop.lon),
            lat: Number(transferStop.lat),
            waitTimeMin: this.roundTo1(edgeCost || transferPenaltyMin),
          });
        }
        continue;
      }

      if (!currentSegment || currentRouteId !== edgeRouteId) {
        finalizeSegment();
        const route = routesById.get(edgeRouteId);
        const fromStop = stopsById.get(fromStopId);
        const toStop = stopsById.get(toStopId);
        if (!route || !fromStop || !toStop) {
          continue;
        }
        const departureMin = currentMinutes + accumulatedMinutes;
        currentSegment = {
          routeId: route.id,
          routeNumber: route.number,
          transportTypeName: route.transportTypeName,
          transportTypeId: route.transportTypeId,
          direction: route.direction,
          fromStop: {
            id: fromStop.id,
            name: fromStop.name,
            lon: Number(fromStop.lon),
            lat: Number(fromStop.lat),
          },
          toStop: {
            id: toStop.id,
            name: toStop.name,
            lon: Number(toStop.lon),
            lat: Number(toStop.lat),
          },
          distanceKm: 0,
          travelTimeMin: 0,
          departureTime: this.formatMinutes(departureMin),
          arrivalTime: this.formatMinutes(departureMin),
        };
        currentRouteId = edgeRouteId;
      } else {
        const toStop = stopsById.get(toStopId);
        if (toStop) {
          currentSegment.toStop = {
            id: toStop.id,
            name: toStop.name,
            lon: Number(toStop.lon),
            lat: Number(toStop.lat),
          };
        }
      }

      segmentTravelMin += edgeCost;
      segmentDistanceKm += (edgeCost * AVERAGE_SPEED_KMH) / 60;
      accumulatedMinutes += edgeCost;
    }

    finalizeSegment();

    if (segments.length === 0) {
      return null;
    }

    const totalTimeMin = this.roundTo1(accumulatedMinutes);
    const totalDistanceKm = this.roundTo1(
      segments.reduce((sum, segment) => sum + segment.distanceKm, 0),
    );

    return {
      totalTimeMin,
      totalDistanceKm,
      transferCount: transfers.length,
      segments,
      transfer: transfers[0],
      transfers,
    };
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
    `)) as unknown as { rows: RouteStopRow[] };

    return transformToCamelCase(result.rows) as RouteStopRow[];
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
        route_id,
        work_start_time,
        work_end_time,
        interval_min
      from guest_api.v_schedules
      where route_id = ${routeId}
      limit 1
    `)) as unknown as { rows: ScheduleRow[] };

    const schedules = transformToCamelCase(result.rows) as ScheduleRow[];
    return schedules[0] ?? null;
  }

  private async findRouteById(routeId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        number,
        direction,
        transport_type_id,
        transport_type_name
      from guest_api.v_routes
      where id = ${routeId}
      limit 1
    `)) as unknown as { rows: RouteRow[] };

    const routes = transformToCamelCase(result.rows) as RouteRow[];
    return routes[0] ?? null;
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

  private getCurrentMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  private getNextDepartureMinutes(
    schedule: ScheduleRow | null,
    currentMinutes: number,
  ) {
    if (!schedule || schedule.intervalMin <= 0) {
      return currentMinutes;
    }

    const startMinutes = this.parseTimeToMinutes(schedule.workStartTime);
    let endMinutes = this.parseTimeToMinutes(schedule.workEndTime);

    let nowMinutes = currentMinutes;
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60;
      if (nowMinutes < startMinutes) {
        nowMinutes += 24 * 60;
      }
    }

    if (nowMinutes <= startMinutes) {
      return startMinutes;
    }

    const diff = nowMinutes - startMinutes;
    const intervals = Math.ceil(diff / schedule.intervalMin);
    const candidate = startMinutes + intervals * schedule.intervalMin;

    if (candidate > endMinutes) {
      return endMinutes;
    }

    return candidate;
  }

  private buildStopIndex(orderedStops: RouteStopRow[]) {
    const map = new Map<number, { index: number; stop: RouteStopRow }>();
    orderedStops.forEach((stop, index) => {
      map.set(stop.stopId, { index, stop });
    });
    return map;
  }

  private findBestSegment(
    orderedStops: RouteStopRow[],
    stopsIndex: Map<number, { index: number; stop: RouteStopRow }>,
    stopsA: StopNearRow[],
    stopsB: StopNearRow[],
  ) {
    let best: {
      fromStop: PlannedSegment['fromStop'];
      toStop: PlannedSegment['toStop'];
      distanceKm: number;
      travelTimeMin: number;
    } | null = null;

    for (const stopA of stopsA) {
      const fromIndex = stopsIndex.get(stopA.id);
      if (!fromIndex) continue;
      for (const stopB of stopsB) {
        const toIndex = stopsIndex.get(stopB.id);
        if (!toIndex || fromIndex.index >= toIndex.index) continue;
        const segment = this.buildSegmentBetweenStops(
          orderedStops,
          stopA.id,
          stopB.id,
        );
        if (!segment) continue;
        if (!best || segment.travelTimeMin < best.travelTimeMin) {
          best = segment;
        }
      }
    }

    return best;
  }

  private findBestSegmentFromTransfer(
    orderedStops: RouteStopRow[],
    stopsIndex: Map<number, { index: number; stop: RouteStopRow }>,
    transferStopId: number,
    stopsB: StopNearRow[],
  ) {
    let best: {
      fromStop: PlannedSegment['fromStop'];
      toStop: PlannedSegment['toStop'];
      distanceKm: number;
      travelTimeMin: number;
    } | null = null;

    const fromIndex = stopsIndex.get(transferStopId);
    if (!fromIndex) {
      return null;
    }

    for (const stopB of stopsB) {
      const toIndex = stopsIndex.get(stopB.id);
      if (!toIndex || fromIndex.index >= toIndex.index) continue;
      const segment = this.buildSegmentBetweenStops(
        orderedStops,
        transferStopId,
        stopB.id,
      );
      if (!segment) continue;
      if (!best || segment.travelTimeMin < best.travelTimeMin) {
        best = segment;
      }
    }

    return best;
  }

  private buildSegmentBetweenStops(
    orderedStops: RouteStopRow[],
    fromStopId: number,
    toStopId: number,
  ) {
    const stopsIndex = this.buildStopIndex(orderedStops);
    const from = stopsIndex.get(fromStopId);
    const to = stopsIndex.get(toStopId);
    if (!from || !to || from.index >= to.index) {
      return null;
    }

    let distanceKm = 0;
    for (let i = from.index; i < to.index; i++) {
      const current = orderedStops[i];
      const next = orderedStops[i + 1];
      if (!next) break;
      if (current.distanceToNextKm != null) {
        distanceKm += Number(current.distanceToNextKm);
      } else {
        distanceKm += this.getDistanceFromLatLonInKm(
          Number(current.lat),
          Number(current.lon),
          Number(next.lat),
          Number(next.lon),
        );
      }
    }

    const travelTimeMin = Math.round((distanceKm / AVERAGE_SPEED_KMH) * 60);

    return {
      fromStop: {
        id: from.stop.stopId,
        name: from.stop.stopName,
        lon: Number(from.stop.lon),
        lat: Number(from.stop.lat),
      },
      toStop: {
        id: to.stop.stopId,
        name: to.stop.stopName,
        lon: Number(to.stop.lon),
        lat: Number(to.stop.lat),
      },
      distanceKm,
      travelTimeMin,
    };
  }

  private getDistanceFromLatLonInKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLon = this.deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
        Math.cos(this.deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number) {
    return deg * (Math.PI / 180);
  }

  // ================================================
  // Route Planning (Service Level)
  // ================================================

  /**
   * Планування маршрутів між двома точками з можливістю пересадок
   */
  async planRoute(payload: {
    lonA: number;
    latA: number;
    lonB: number;
    latB: number;
    radius?: number;
    maxWaitMin?: number;
    maxResults?: number;
  }): Promise<PlannedRouteOption[]> {
    const radius = payload.radius ?? 1000;
    const maxResults = payload.maxResults ?? 5;
    // Higher transfer penalty to prefer direct routes (includes wait time + walking + uncertainty)
    const transferPenaltyMin = payload.maxWaitMin ?? 12;
    const currentMinutes = this.getCurrentMinutes();

    const stopsA = await this.findStopsNear(
      payload.lonA,
      payload.latA,
      radius,
      maxResults,
    );
    const stopsB = await this.findStopsNear(
      payload.lonB,
      payload.latB,
      radius,
      maxResults,
    );

    if (!stopsA.length || !stopsB.length) {
      return [];
    }

    const startStopIds = stopsA.map((stop) => stop.id);
    const endStopIds = stopsB.map((stop) => stop.id);
    const pathRows = await this.findPgRoutingPath(
      startStopIds,
      endStopIds,
      transferPenaltyMin,
      maxResults,
    );

    if (pathRows.length === 0) {
      return [];
    }

    const stopIds = Array.from(
      new Set(
        pathRows
          .map((row) => row.stopId)
          .filter((stopId): stopId is number => stopId != null),
      ),
    );
    const routeIds = Array.from(
      new Set(
        pathRows
          .map((row) => row.routeId)
          .filter((routeId): routeId is number => routeId != null),
      ),
    );

    const [stops, routes] = await Promise.all([
      this.findStopsByIds(stopIds),
      this.findRoutesByIds(routeIds),
    ]);

    const stopsById = new Map(stops.map((stop) => [stop.id, stop]));
    const routesById = new Map(routes.map((route) => [route.id, route]));

    const groupedPaths = new Map<number, PgrPathRow[]>();
    for (const row of pathRows) {
      const list = groupedPaths.get(row.pathId) ?? [];
      list.push(row);
      groupedPaths.set(row.pathId, list);
    }

    const options: PlannedRouteOption[] = [];
    for (const rows of groupedPaths.values()) {
      const option = this.buildRouteOptionFromPath(
        rows,
        stopsById,
        routesById,
        currentMinutes,
        transferPenaltyMin,
      );
      if (option) {
        options.push(option);
      }
    }

    // Sort by weighted score: prefer direct routes over transfers
    // Add 5 min penalty per transfer to make direct routes preferred when times are close
    const TRANSFER_SORT_PENALTY = 5;
    options.sort((a, b) => {
      const scoreA = a.totalTimeMin + a.transferCount * TRANSFER_SORT_PENALTY;
      const scoreB = b.totalTimeMin + b.transferCount * TRANSFER_SORT_PENALTY;
      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }
      // If scores are equal, prefer fewer transfers
      return a.transferCount - b.transferCount;
    });
    return options.slice(0, maxResults);
  }

  /**
   * Пошук зупинок за назвою
   * Використовує PostgreSQL функцію guest_api.search_stops_by_name()
   */
  async searchStops(query: string, limit: number = 10) {
    const result = await this.dbService.db.execute(sql`
      SELECT id, name, lon, lat
      FROM guest_api.search_stops_by_name(${query}, ${limit})
    `);

    return result.rows;
  }
}
