import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { cardTopUps } from '../db/schema';
import { CreateCardTopUpDto } from './dto/create-card-top-up.dto';
import { UpdateCardTopUpDto } from './dto/update-card-top-up.dto';

@Injectable()
export class CardTopUpsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(cardTopUps);
  }

  async findOne(id: number) {
    const [topUp] = await this.dbService.db
      .select()
      .from(cardTopUps)
      .where(eq(cardTopUps.id, id));

    if (!topUp) {
      throw new NotFoundException(`Card top-up ${id} not found`);
    }

    return topUp;
  }

  async create(payload: CreateCardTopUpDto) {
    const [created] = await this.dbService.db
      .insert(cardTopUps)
      .values({
        cardId: payload.cardId,
        amount: payload.amount.toString(),
        toppedUpAt: payload.toppedUpAt,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateCardTopUpDto) {
    const updates: Partial<typeof cardTopUps.$inferInsert> = {};

    if (payload.cardId !== undefined) {
      updates.cardId = payload.cardId;
    }
    if (payload.amount !== undefined) {
      updates.amount = payload.amount.toString();
    }
    if (payload.toppedUpAt !== undefined) {
      updates.toppedUpAt = payload.toppedUpAt;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(cardTopUps)
      .set(updates)
      .where(eq(cardTopUps.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Card top-up ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(cardTopUps)
      .where(eq(cardTopUps.id, id))
      .returning({ id: cardTopUps.id });

    if (!deleted) {
      throw new NotFoundException(`Card top-up ${id} not found`);
    }

    return deleted;
  }
}
