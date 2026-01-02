import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { routeStops, routes, stops, transportTypes } from '../../db/schema';
import { CreateRouteStopDto } from './dto/create-route-stop.dto';
import { UpdateRouteStopDto } from './dto/update-route-stop.dto';

@Injectable()
export class RouteStopsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(routeStops);
  }

  async findOne(id: number) {
    const [routeStop] = await this.dbService.db
      .select()
      .from(routeStops)
      .where(eq(routeStops.id, id));

    if (!routeStop) {
      throw new NotFoundException(`Route stop ${id} not found`);
    }

    return routeStop;
  }

  async findStopsByRouteId(routeId: number) {
    const rows = await this.dbService.db
      .select({
        id: routeStops.id,
        routeId: routeStops.routeId,
        stopId: routeStops.stopId,
        prevRouteStopId: routeStops.prevRouteStopId,
        nextRouteStopId: routeStops.nextRouteStopId,
        distanceToNextKm: routeStops.distanceToNextKm,
        stopName: stops.name,
        lon: stops.lon,
        lat: stops.lat,
      })
      .from(routeStops)
      .innerJoin(stops, eq(routeStops.stopId, stops.id))
      .where(eq(routeStops.routeId, routeId));

    if (rows.length === 0) {
      return [];
    }

    const byId = new Map(rows.map((row) => [row.id, row]));
    const start = rows.find((row) => row.prevRouteStopId === null);

    if (!start) {
      return rows.sort((a, b) => a.id - b.id);
    }

    const ordered: typeof rows = [];
    const visited = new Set<number>();
    let current: (typeof rows)[number] | undefined = start;

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

  async findRoutesByStopId(stopId: number) {
    return this.dbService.db
      .select({
        routeId: routeStops.routeId,
        routeNumber: routes.number,
        transportTypeId: routes.transportTypeId,
        direction: routes.direction,
        transportTypeName: transportTypes.name,
      })
      .from(routeStops)
      .innerJoin(routes, eq(routeStops.routeId, routes.id))
      .innerJoin(transportTypes, eq(routes.transportTypeId, transportTypes.id))
      .where(eq(routeStops.stopId, stopId));
  }

  async create(payload: CreateRouteStopDto) {
    const [created] = await this.dbService.db
      .insert(routeStops)
      .values({
        routeId: payload.routeId,
        stopId: payload.stopId,
        prevRouteStopId: payload.prevRouteStopId,
        nextRouteStopId: payload.nextRouteStopId,
        distanceToNextKm:
          payload.distanceToNextKm !== undefined
            ? payload.distanceToNextKm.toString()
            : undefined,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateRouteStopDto) {
    const updates: Partial<typeof routeStops.$inferInsert> = {};

    if (payload.routeId !== undefined) {
      updates.routeId = payload.routeId;
    }
    if (payload.stopId !== undefined) {
      updates.stopId = payload.stopId;
    }
    if (payload.prevRouteStopId !== undefined) {
      updates.prevRouteStopId = payload.prevRouteStopId;
    }
    if (payload.nextRouteStopId !== undefined) {
      updates.nextRouteStopId = payload.nextRouteStopId;
    }
    if (payload.distanceToNextKm !== undefined) {
      updates.distanceToNextKm = payload.distanceToNextKm.toString();
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(routeStops)
      .set(updates)
      .where(eq(routeStops.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Route stop ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(routeStops)
      .where(eq(routeStops.id, id))
      .returning({ id: routeStops.id });

    if (!deleted) {
      throw new NotFoundException(`Route stop ${id} not found`);
    }

    return deleted;
  }
}
