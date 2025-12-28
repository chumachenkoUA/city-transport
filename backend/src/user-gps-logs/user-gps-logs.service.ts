import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { userGpsLogs } from '../db/schema';
import { CreateUserGpsLogDto } from './dto/create-user-gps-log.dto';
import { UpdateUserGpsLogDto } from './dto/update-user-gps-log.dto';

@Injectable()
export class UserGpsLogsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(userGpsLogs);
  }

  async findOne(id: number) {
    const [log] = await this.dbService.db
      .select()
      .from(userGpsLogs)
      .where(eq(userGpsLogs.id, id));

    if (!log) {
      throw new NotFoundException(`User GPS log ${id} not found`);
    }

    return log;
  }

  async create(payload: CreateUserGpsLogDto) {
    const [created] = await this.dbService.db
      .insert(userGpsLogs)
      .values({
        userId: payload.userId,
        lon: payload.lon.toString(),
        lat: payload.lat.toString(),
        recordedAt: payload.recordedAt,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateUserGpsLogDto) {
    const updates: Partial<typeof userGpsLogs.$inferInsert> = {};

    if (payload.userId !== undefined) {
      updates.userId = payload.userId;
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
      .update(userGpsLogs)
      .set(updates)
      .where(eq(userGpsLogs.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`User GPS log ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(userGpsLogs)
      .where(eq(userGpsLogs.id, id))
      .returning({ id: userGpsLogs.id });

    if (!deleted) {
      throw new NotFoundException(`User GPS log ${id} not found`);
    }

    return deleted;
  }
}
