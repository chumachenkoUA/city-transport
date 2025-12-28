import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { vehicleGpsLogs } from '../db/schema';
import { CreateVehicleGpsLogDto } from './dto/create-vehicle-gps-log.dto';
import { UpdateVehicleGpsLogDto } from './dto/update-vehicle-gps-log.dto';

@Injectable()
export class VehicleGpsLogsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(vehicleGpsLogs);
  }

  async findOne(id: number) {
    const [log] = await this.dbService.db
      .select()
      .from(vehicleGpsLogs)
      .where(eq(vehicleGpsLogs.id, id));

    if (!log) {
      throw new NotFoundException(`Vehicle GPS log ${id} not found`);
    }

    return log;
  }

  async create(payload: CreateVehicleGpsLogDto) {
    const [created] = await this.dbService.db
      .insert(vehicleGpsLogs)
      .values({
        vehicleId: payload.vehicleId,
        lon: payload.lon.toString(),
        lat: payload.lat.toString(),
        recordedAt: payload.recordedAt,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateVehicleGpsLogDto) {
    const updates: Partial<typeof vehicleGpsLogs.$inferInsert> = {};

    if (payload.vehicleId !== undefined) {
      updates.vehicleId = payload.vehicleId;
    }
    if (payload.lon !== undefined) {
      updates.lon = payload.lon.toString();
    }
    if (payload.lat !== undefined) {
      updates.lat = payload.lat.toString();
    }
    if (payload.recordedAt !== undefined) {
      updates.recordedAt = payload.recordedAt;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(vehicleGpsLogs)
      .set(updates)
      .where(eq(vehicleGpsLogs.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Vehicle GPS log ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(vehicleGpsLogs)
      .where(eq(vehicleGpsLogs.id, id))
      .returning({ id: vehicleGpsLogs.id });

    if (!deleted) {
      throw new NotFoundException(`Vehicle GPS log ${id} not found`);
    }

    return deleted;
  }
}
