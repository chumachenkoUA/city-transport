import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { routePoints } from '../../db/schema';
import { CreateRoutePointDto } from './dto/create-route-point.dto';
import { UpdateRoutePointDto } from './dto/update-route-point.dto';

@Injectable()
export class RoutePointsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(routePoints);
  }

  async findOne(id: number) {
    const [routePoint] = await this.dbService.db
      .select()
      .from(routePoints)
      .where(eq(routePoints.id, id));

    if (!routePoint) {
      throw new NotFoundException(`Route point ${id} not found`);
    }

    return routePoint;
  }

  async create(payload: CreateRoutePointDto) {
    const [created] = await this.dbService.db
      .insert(routePoints)
      .values({
        routeId: payload.routeId,
        lon: payload.lon.toString(),
        lat: payload.lat.toString(),
        prevRoutePointId: payload.prevRoutePointId,
        nextRoutePointId: payload.nextRoutePointId,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateRoutePointDto) {
    const updates: Partial<typeof routePoints.$inferInsert> = {};

    if (payload.routeId !== undefined) {
      updates.routeId = payload.routeId;
    }
    if (payload.lon !== undefined) {
      updates.lon = payload.lon.toString();
    }
    if (payload.lat !== undefined) {
      updates.lat = payload.lat.toString();
    }
    if (payload.prevRoutePointId !== undefined) {
      updates.prevRoutePointId = payload.prevRoutePointId;
    }
    if (payload.nextRoutePointId !== undefined) {
      updates.nextRoutePointId = payload.nextRoutePointId;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(routePoints)
      .set(updates)
      .where(eq(routePoints.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Route point ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(routePoints)
      .where(eq(routePoints.id, id))
      .returning({ id: routePoints.id });

    if (!deleted) {
      throw new NotFoundException(`Route point ${id} not found`);
    }

    return deleted;
  }
}
