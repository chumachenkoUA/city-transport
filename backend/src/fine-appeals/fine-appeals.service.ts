import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { fineAppeals } from '../db/schema';
import { CreateFineAppealDto } from './dto/create-fine-appeal.dto';
import { UpdateFineAppealDto } from './dto/update-fine-appeal.dto';

@Injectable()
export class FineAppealsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(fineAppeals);
  }

  async findOne(id: number) {
    const [appeal] = await this.dbService.db
      .select()
      .from(fineAppeals)
      .where(eq(fineAppeals.id, id));

    if (!appeal) {
      throw new NotFoundException(`Fine appeal ${id} not found`);
    }

    return appeal;
  }

  async create(payload: CreateFineAppealDto) {
    const [created] = await this.dbService.db
      .insert(fineAppeals)
      .values({
        fineId: payload.fineId,
        message: payload.message,
        status: payload.status,
        createdAt: payload.createdAt,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateFineAppealDto) {
    const updates: Partial<typeof fineAppeals.$inferInsert> = {};

    if (payload.fineId !== undefined) {
      updates.fineId = payload.fineId;
    }
    if (payload.message !== undefined) {
      updates.message = payload.message;
    }
    if (payload.status !== undefined) {
      updates.status = payload.status;
    }
    if (payload.createdAt !== undefined) {
      updates.createdAt = payload.createdAt;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(fineAppeals)
      .set(updates)
      .where(eq(fineAppeals.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Fine appeal ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(fineAppeals)
      .where(eq(fineAppeals.id, id))
      .returning({ id: fineAppeals.id });

    if (!deleted) {
      throw new NotFoundException(`Fine appeal ${id} not found`);
    }

    return deleted;
  }
}
