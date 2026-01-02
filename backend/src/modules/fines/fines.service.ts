import { Injectable, NotFoundException } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { fines } from '../../db/schema';
import { CreateFineDto } from './dto/create-fine.dto';
import { UpdateFineDto } from './dto/update-fine.dto';

@Injectable()
export class FinesService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(fines);
  }

  async findByUserId(userId: number) {
    return this.dbService.db
      .select()
      .from(fines)
      .where(eq(fines.userId, userId));
  }

  async sumPaidByPeriod(from: Date, to: Date) {
    const result = (await this.dbService.db.execute(sql`
      select coalesce(sum(amount), 0) as total
      from fines
      where status = 'Оплачено' and issued_at >= ${from} and issued_at <= ${to}
    `)) as unknown as {
      rows: Array<{ total: string }>;
    };

    return result.rows[0]?.total ?? '0';
  }

  async findOne(id: number) {
    const [fine] = await this.dbService.db
      .select()
      .from(fines)
      .where(eq(fines.id, id));

    if (!fine) {
      throw new NotFoundException(`Fine ${id} not found`);
    }

    return fine;
  }

  async findOneByUserId(userId: number, fineId: number) {
    const [fine] = await this.dbService.db
      .select()
      .from(fines)
      .where(and(eq(fines.id, fineId), eq(fines.userId, userId)));

    return fine ?? null;
  }

  async create(payload: CreateFineDto) {
    const [created] = await this.dbService.db
      .insert(fines)
      .values({
        userId: payload.userId,
        status: payload.status ?? 'Очікує сплати',
        amount: payload.amount.toString(),
        reason: payload.reason,
        tripId: payload.tripId,
        issuedAt: payload.issuedAt,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateFineDto) {
    const updates: Partial<typeof fines.$inferInsert> = {};

    if (payload.userId !== undefined) {
      updates.userId = payload.userId;
    }
    if (payload.status !== undefined) {
      updates.status = payload.status;
    }
    if (payload.amount !== undefined) {
      updates.amount = payload.amount.toString();
    }
    if (payload.reason !== undefined) {
      updates.reason = payload.reason;
    }
    if (payload.tripId !== undefined) {
      updates.tripId = payload.tripId;
    }
    if (payload.issuedAt !== undefined) {
      updates.issuedAt = payload.issuedAt;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(fines)
      .set(updates)
      .where(eq(fines.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Fine ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(fines)
      .where(eq(fines.id, id))
      .returning({ id: fines.id });

    if (!deleted) {
      throw new NotFoundException(`Fine ${id} not found`);
    }

    return deleted;
  }
}
