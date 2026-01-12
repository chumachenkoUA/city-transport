import { BadRequestException, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { transformToCamelCase } from '../../common/utils/transform-to-camel-case';
import { DbService } from '../../db/db.service';
import { CreateStopDto } from '../../modules/stops/dto/create-stop.dto';
import { UpdateStopDto } from '../../modules/stops/dto/update-stop.dto';
import { MunicipalityComplaintsQueryDto } from './dto/complaints-query.dto';
import { CreateMunicipalityRouteDto } from './dto/create-route.dto';
import { PassengerFlowQueryDto } from './dto/passenger-flow-query.dto';

type TransportTypeRow = {
  id: number;
  name: string;
};

type StopRow = {
  id: number;
  name: string;
  lon: string;
  lat: string;
};

type RouteRow = {
  id: number;
  number: string;
  direction: string;
  isActive: boolean;
  transportTypeId: number;
  transportType: string;
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

type PassengerFlowRow = {
  tripDate: string;
  routeNumber: string;
  transportType: string;
  passengerCount: number;
};

type ComplaintRow = {
  id: number;
  type: string;
  message: string;
  status: string;
  createdAt: string;
  routeNumber: string | null;
  transportType: string | null;
  fleetNumber: string | null;
  contactInfo: string | null;
};

@Injectable()
export class CtMunicipalityService {
  constructor(private readonly dbService: DbService) {}

  async listTransportTypes() {
    const result = (await this.dbService.db.execute(sql`
      select id, name
      from guest_api.v_transport_types
      order by id
    `)) as unknown as { rows: TransportTypeRow[] };

    return result.rows;
  }

  async listStops() {
    // Using municipality_api view for stops list (created in 0015)
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        name,
        lon,
        lat
      from municipality_api.v_stops
      order by id desc
    `)) as unknown as { rows: StopRow[] };

    return result.rows;
  }

  async createStop(payload: CreateStopDto) {
    const result = (await this.dbService.db.execute(sql`
      select municipality_api.create_stop(
        ${payload.name},
        ${payload.lon}::numeric,
        ${payload.lat}::numeric
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0]?.id };
  }

  async updateStop(id: number, payload: UpdateStopDto) {
    if (
      !payload.name ||
      payload.lon === undefined ||
      payload.lat === undefined
    ) {
      throw new BadRequestException('name, lon, and lat are required');
    }

    await this.dbService.db.execute(sql`
      select municipality_api.update_stop(
        ${id},
        ${payload.name},
        ${payload.lon}::numeric,
        ${payload.lat}::numeric
      )
    `);

    return { success: true };
  }

  async listRoutes() {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        number,
        direction,
        is_active,
        transport_type_id,
        transport_type
      from municipality_api.v_routes
      order by number
    `)) as unknown as { rows: RouteRow[] };

    return transformToCamelCase(result.rows) as RouteRow[];
  }

  async listRouteStops(routeId: number) {
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

    const stops = transformToCamelCase(result.rows) as RouteStopRow[];
    return this.orderRouteStops(stops);
  }

  async listRoutePoints(routeId: number) {
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

    const points = transformToCamelCase(result.rows) as RoutePointRow[];
    return this.orderRoutePoints(points);
  }

  async createRoute(payload: CreateMunicipalityRouteDto) {
    const stopsJson = payload.stops.map((stop) => ({
      stop_id: stop.stopId ?? null,
      name: stop.name ?? null,
      lon: stop.lon ?? null,
      lat: stop.lat ?? null,
      distance_to_next_km: stop.distanceToNextKm ?? null,
    }));

    const pointsJson = payload.points.map((point) => ({
      lon: point.lon,
      lat: point.lat,
    }));

    const result = (await this.dbService.db.execute(sql`
      select municipality_api.create_route_full(
        ${payload.number},
        ${payload.transportTypeId}::integer,
        ${payload.direction},
        ${JSON.stringify(stopsJson)}::jsonb,
        ${JSON.stringify(pointsJson)}::jsonb
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    const routeId = result.rows[0]?.id;
    if (!routeId) {
      throw new BadRequestException('Failed to create route');
    }

    // Return created data
    const route = await this.findRouteById(routeId);

    // Fetch stops/points via guest_api
    const routeStops = await this.listRouteStops(routeId);
    const routePoints = await this.listRoutePoints(routeId);

    return { route, routeStops, routePoints };
  }

  async getPassengerFlow(query: PassengerFlowQueryDto) {
    const { from, to } = this.parsePeriod(query);
    const transportTypeName = query.transportTypeId
      ? await this.getTransportTypeName(query.transportTypeId)
      : null;
    const routeNumber = query.routeNumber ?? null;

    const result = (await this.dbService.db.execute(sql`
      with filters as (
        select
          ${routeNumber}::text as route_number,
          ${transportTypeName}::text as transport_type
      )
      select
        v.trip_date,
        v.route_number,
        v.transport_type,
        v.passenger_count
      from municipality_api.v_passenger_flow_analytics v
      cross join filters
      where v.trip_date >= ${from}::date
        and v.trip_date <= ${to}::date
        and (filters.route_number is null or v.route_number = filters.route_number)
        and (filters.transport_type is null or v.transport_type = filters.transport_type)
      order by v.trip_date desc
    `)) as unknown as { rows: PassengerFlowRow[] };

    return transformToCamelCase(result.rows) as PassengerFlowRow[];
  }

  async getComplaints(query: MunicipalityComplaintsQueryDto) {
    const { from, to } = this.parsePeriod(query);
    const transportTypeName = query.transportTypeId
      ? await this.getTransportTypeName(query.transportTypeId)
      : null;
    const routeNumber = query.routeNumber ?? null;
    const fleetNumber = query.fleetNumber ?? null;

    const result = (await this.dbService.db.execute(sql`
      with filters as (
        select
          ${routeNumber}::text as route_number,
          ${transportTypeName}::text as transport_type,
          ${fleetNumber}::text as fleet_number
      )
      select
        v.id,
        v.type,
        v.message,
        v.status,
        v.created_at,
        v.route_number,
        v.transport_type,
        v.fleet_number,
        v.contact_info
      from municipality_api.v_complaints_dashboard v
      cross join filters
      where v.created_at >= ${from}::date
        and v.created_at < ${to}::date + 1
        and (filters.route_number is null or v.route_number = filters.route_number)
        and (filters.transport_type is null or v.transport_type = filters.transport_type)
        and (filters.fleet_number is null or v.fleet_number = filters.fleet_number)
      order by v.created_at desc
    `)) as unknown as { rows: ComplaintRow[] };

    return transformToCamelCase(result.rows) as ComplaintRow[];
  }

  async setRouteActive(routeId: number, isActive: boolean) {
    await this.dbService.db.execute(sql`
      select municipality_api.set_route_active(
        ${routeId}::bigint,
        ${isActive}
      )
    `);

    return { success: true };
  }

  async updateComplaintStatus(id: number, status: string) {
    await this.dbService.db.execute(sql`
      select municipality_api.update_complaint_status(
        ${id}::bigint,
        ${status}
      )
    `);

    return { success: true };
  }

  private async findRouteById(routeId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        number,
        direction,
        is_active,
        transport_type_id,
        transport_type
      from municipality_api.v_routes
      where id = ${routeId}
      limit 1
    `)) as unknown as { rows: RouteRow[] };

    const routes = transformToCamelCase(result.rows) as RouteRow[];
    return routes[0] ?? null;
  }

  private async getTransportTypeName(id: number) {
    const result = (await this.dbService.db.execute(
      sql`select name from public.transport_types where id = ${id}`,
    )) as unknown as { rows: { name: string }[] };
    return result.rows[0]?.name;
  }

  private parsePeriod(query: { from?: string; to?: string }) {
    if (!query.from || !query.to) {
      // Default to last 30 days
      const to = new Date();
      const from = new Date();
      from.setDate(from.getDate() - 30);
      return {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
      };
    }

    return { from: query.from, to: query.to };
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

  private orderRoutePoints(rows: RoutePointRow[]) {
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
}
