import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { transportCards } from '../../db/schema';
import { CreateTransportCardDto } from './dto/create-transport-card.dto';
import { UpdateTransportCardDto } from './dto/update-transport-card.dto';

@Injectable()
export class TransportCardsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(transportCards);
  }

  async findOne(id: number) {
    const [card] = await this.dbService.db
      .select()
      .from(transportCards)
      .where(eq(transportCards.id, id));

    if (!card) {
      throw new NotFoundException(`Transport card ${id} not found`);
    }

    return card;
  }

  async findByCardNumber(cardNumber: string) {
    const [card] = await this.dbService.db
      .select()
      .from(transportCards)
      .where(eq(transportCards.cardNumber, cardNumber));

    return card ?? null;
  }

  async create(payload: CreateTransportCardDto) {
    const [created] = await this.dbService.db
      .insert(transportCards)
      .values({
        userId: payload.userId,
        cardNumber: payload.cardNumber,
        balance:
          payload.balance !== undefined
            ? payload.balance.toString()
            : undefined,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateTransportCardDto) {
    const updates: Partial<typeof transportCards.$inferInsert> = {};

    if (payload.userId !== undefined) {
      updates.userId = payload.userId;
    }
    if (payload.cardNumber !== undefined) {
      updates.cardNumber = payload.cardNumber;
    }
    if (payload.balance !== undefined) {
      updates.balance = payload.balance.toString();
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(transportCards)
      .set(updates)
      .where(eq(transportCards.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Transport card ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(transportCards)
      .where(eq(transportCards.id, id))
      .returning({ id: transportCards.id });

    if (!deleted) {
      throw new NotFoundException(`Transport card ${id} not found`);
    }

    return deleted;
  }
}
