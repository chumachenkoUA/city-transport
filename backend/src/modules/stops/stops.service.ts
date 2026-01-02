import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { stops } from '../../db/schema';
import { CreateStopDto } from './dto/create-stop.dto';
import { UpdateStopDto } from './dto/update-stop.dto';

@Injectable()
export class StopsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(stops);
  }

  async findNearby(
    lon: number,
    lat: number,
    radiusMeters = 500,
    limit = 10,
  ) {
    const result = (await this.dbService.db.execute(sql`
      select
        id,
        name,
        lon,
        lat,
        ST_Distance(
          geom,
          ST_SetSRID(ST_MakePoint(${lon}::double precision, ${lat}::double precision), 4326)::geography
        ) as distance_m
      from stops
      where ST_DWithin(
        geom,
        ST_SetSRID(ST_MakePoint(${lon}::double precision, ${lat}::double precision), 4326)::geography,
        ${radiusMeters}
      )
      order by distance_m
      limit ${limit}
    `)) as unknown as {
      rows: Array<{
        id: number;
        name: string;
        lon: string;
        lat: string;
        distance_m: number;
      }>;
    };

    return result.rows;
  }

  async findNearest(lon: number, lat: number, radiusMeters = 500) {
    const [nearest] = await this.findNearby(lon, lat, radiusMeters, 1);
    return nearest ?? null;
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
