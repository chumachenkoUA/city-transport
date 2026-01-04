import { BadRequestException, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
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
  day: string;
  fleetNumber: string;
  routeNumber: string;
  transportTypeId: number;
  passengerCount: string;
};

type ComplaintRow = {
  id: number;
  userId: number;
  type: string;
  message: string;
  status: string;
  tripId: number | null;
  createdAt: Date | null;
  routeNumber: string | null;
  transportTypeId: number | null;
  transportType: string | null;
  fleetNumber: string | null;
};

@Injectable()
export class CtMunicipalityService {
  constructor(private readonly dbService: DbService) {}

  async listTransportTypes() {
    const result = (await this.dbService.db.execute(sql`
      select id as "id", name as "name"
      from municipality_api.v_transport_types
      order by id
    `)) as unknown as { rows: TransportTypeRow[] };

    return result.rows;
  }

  async listStops() {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        name as "name",
        lon as "lon",
        lat as "lat"
      from municipality_api.v_stops
      order by id desc
    `)) as unknown as { rows: StopRow[] };

    return result.rows;
  }

  async createStop(payload: CreateStopDto) {
    const result = (await this.dbService.db.execute(sql`
      select municipality_api.create_stop(
        ${payload.name},
        ${payload.lon},
        ${payload.lat}
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    return { id: result.rows[0]?.id };
  }

  async updateStop(id: number, payload: UpdateStopDto) {
    if (!payload.name || payload.lon === undefined || payload.lat === undefined) {
      throw new BadRequestException('name, lon, and lat are required');
    }

    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        name as "name",
        lon as "lon",
        lat as "lat"
      from municipality_api.update_stop(
        ${id},
        ${payload.name},
        ${payload.lon},
        ${payload.lat}
      )
    `)) as unknown as { rows: StopRow[] };

    return result.rows[0] ?? null;
  }

  async listRoutes() {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        number as "number",
        direction as "direction",
        is_active as "isActive",
        transport_type_id as "transportTypeId",
        transport_type as "transportType"
      from municipality_api.v_routes
      order by number
    `)) as unknown as { rows: RouteRow[] };

    return result.rows;
  }

  async listRouteStops(routeId: number) {
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
      from municipality_api.v_route_stops
      where route_id = ${routeId}
      order by id
    `)) as unknown as { rows: RouteStopRow[] };

    return result.rows;
  }

  async listRoutePoints(routeId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        route_id as "routeId",
        lon as "lon",
        lat as "lat",
        prev_route_point_id as "prevRoutePointId",
        next_route_point_id as "nextRoutePointId"
      from municipality_api.v_route_points
      where route_id = ${routeId}
      order by id
    `)) as unknown as { rows: RoutePointRow[] };

    return result.rows;
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
      select municipality_api.create_route(
        ${payload.transportTypeId},
        ${payload.number},
        ${payload.direction},
        ${payload.isActive ?? true},
        ${JSON.stringify(stopsJson)},
        ${JSON.stringify(pointsJson)}
      ) as "id"
    `)) as unknown as { rows: Array<{ id: number }> };

    const routeId = result.rows[0]?.id;
    if (!routeId) {
      throw new BadRequestException('Failed to create route');
    }

    const route = await this.findRouteById(routeId);
    const routeStops = await this.listRouteStops(routeId);
    const routePoints = await this.listRoutePoints(routeId);

    return { route, routeStops, routePoints };
  }

  async getPassengerFlow(query: PassengerFlowQueryDto) {
    const { from, to } = this.parsePeriod(query);

    const result = (await this.dbService.db.execute(sql`
      select
        day as "day",
        fleet_number as "fleetNumber",
        route_number as "routeNumber",
        transport_type_id as "transportTypeId",
        passenger_count as "passengerCount"
      from municipality_api.passenger_flow(
        ${from},
        ${to},
        ${query.routeNumber ?? null},
        ${query.transportTypeId ?? null}
      )
    `)) as unknown as { rows: PassengerFlowRow[] };

    return result.rows;
  }

  async getComplaints(query: MunicipalityComplaintsQueryDto) {
    const { from, to } = this.parsePeriod(query);

    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        user_id as "userId",
        type as "type",
        message as "message",
        status as "status",
        trip_id as "tripId",
        created_at as "createdAt",
        route_number as "routeNumber",
        transport_type_id as "transportTypeId",
        transport_type as "transportType",
        fleet_number as "fleetNumber"
      from municipality_api.complaints(
        ${from},
        ${to},
        ${query.routeNumber ?? null},
        ${query.transportTypeId ?? null},
        ${query.fleetNumber ?? null}
      )
    `)) as unknown as { rows: ComplaintRow[] };

    return result.rows;
  }

  private async findRouteById(routeId: number) {
    const result = (await this.dbService.db.execute(sql`
      select
        id as "id",
        number as "number",
        direction as "direction",
        is_active as "isActive",
        transport_type_id as "transportTypeId",
        transport_type as "transportType"
      from municipality_api.v_routes
      where id = ${routeId}
      limit 1
    `)) as unknown as { rows: RouteRow[] };

    return result.rows[0] ?? null;
  }

  private parsePeriod(query: { from: string; to: string }) {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      throw new BadRequestException('Invalid period dates');
    }

    if (from > to) {
      throw new BadRequestException('from must be before to');
    }

    return { from, to };
  }
}
