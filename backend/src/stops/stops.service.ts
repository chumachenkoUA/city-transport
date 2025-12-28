import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { stops } from '../db/schema';
import { CreateStopDto } from './dto/create-stop.dto';
import { UpdateStopDto } from './dto/update-stop.dto';

@Injectable()
export class StopsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(stops);
  }

  async findOne(id: number) {
    const [stop] = await this.dbService.db
      .select()
      .from(stops)
      .where(eq(stops.id, id));

    if (!stop) {
      throw new NotFoundException(`Stop ${id} not found`);
    }

    return stop;
  }

  async create(payload: CreateStopDto) {
    const [created] = await this.dbService.db
      .insert(stops)
      .values({
        name: payload.name,
        lon: payload.lon.toString(),
        lat: payload.lat.toString(),
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateStopDto) {
    const updates: Partial<typeof stops.$inferInsert> = {};

    if (payload.name !== undefined) {
      updates.name = payload.name;
    }
    if (payload.lon !== undefined) {
      updates.lon = payload.lon.toString();
    }
    if (payload.lat !== undefined) {
      updates.lat = payload.lat.toString();
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(stops)
      .set(updates)
      .where(eq(stops.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Stop ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(stops)
      .where(eq(stops.id, id))
      .returning({ id: stops.id });

    if (!deleted) {
      throw new NotFoundException(`Stop ${id} not found`);
    }

    return deleted;
  }
}
