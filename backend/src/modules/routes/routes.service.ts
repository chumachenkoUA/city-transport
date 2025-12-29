import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { routes } from '../../db/schema';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

@Injectable()
export class RoutesService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(routes);
  }

  async findOne(id: number) {
    const [route] = await this.dbService.db
      .select()
      .from(routes)
      .where(eq(routes.id, id));

    if (!route) {
      throw new NotFoundException(`Route ${id} not found`);
    }

    return route;
  }

  async create(payload: CreateRouteDto) {
    const [created] = await this.dbService.db
      .insert(routes)
      .values({
        transportTypeId: payload.transportTypeId,
        number: payload.number,
        direction: payload.direction,
        isActive: payload.isActive ?? true,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateRouteDto) {
    const updates: Partial<typeof routes.$inferInsert> = {};

    if (payload.transportTypeId !== undefined) {
      updates.transportTypeId = payload.transportTypeId;
    }
    if (payload.number !== undefined) {
      updates.number = payload.number;
    }
    if (payload.direction !== undefined) {
      updates.direction = payload.direction;
    }
    if (payload.isActive !== undefined) {
      updates.isActive = payload.isActive;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(routes)
      .set(updates)
      .where(eq(routes.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Route ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(routes)
      .where(eq(routes.id, id))
      .returning({ id: routes.id });

    if (!deleted) {
      throw new NotFoundException(`Route ${id} not found`);
    }

    return deleted;
  }
}
