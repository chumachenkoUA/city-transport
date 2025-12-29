import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { schedules } from '../../db/schema';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';

@Injectable()
export class SchedulesService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(schedules);
  }

  async findOne(id: number) {
    const [schedule] = await this.dbService.db
      .select()
      .from(schedules)
      .where(eq(schedules.id, id));

    if (!schedule) {
      throw new NotFoundException(`Schedule ${id} not found`);
    }

    return schedule;
  }

  async create(payload: CreateScheduleDto) {
    const [created] = await this.dbService.db
      .insert(schedules)
      .values({
        routeId: payload.routeId,
        workStartTime: payload.workStartTime,
        workEndTime: payload.workEndTime,
        intervalMin: payload.intervalMin,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateScheduleDto) {
    const updates: Partial<typeof schedules.$inferInsert> = {};

    if (payload.routeId !== undefined) {
      updates.routeId = payload.routeId;
    }
    if (payload.workStartTime !== undefined) {
      updates.workStartTime = payload.workStartTime;
    }
    if (payload.workEndTime !== undefined) {
      updates.workEndTime = payload.workEndTime;
    }
    if (payload.intervalMin !== undefined) {
      updates.intervalMin = payload.intervalMin;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(schedules)
      .set(updates)
      .where(eq(schedules.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Schedule ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(schedules)
      .where(eq(schedules.id, id))
      .returning({ id: schedules.id });

    if (!deleted) {
      throw new NotFoundException(`Schedule ${id} not found`);
    }

    return deleted;
  }
}
