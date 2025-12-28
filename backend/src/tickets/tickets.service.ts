import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { tickets } from '../db/schema';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';

@Injectable()
export class TicketsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(tickets);
  }

  async findOne(id: number) {
    const [ticket] = await this.dbService.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, id));

    if (!ticket) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return ticket;
  }

  async create(payload: CreateTicketDto) {
    const [created] = await this.dbService.db
      .insert(tickets)
      .values({
        tripId: payload.tripId,
        cardId: payload.cardId,
        price: payload.price.toString(),
        purchasedAt: payload.purchasedAt,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateTicketDto) {
    const updates: Partial<typeof tickets.$inferInsert> = {};

    if (payload.tripId !== undefined) {
      updates.tripId = payload.tripId;
    }
    if (payload.cardId !== undefined) {
      updates.cardId = payload.cardId;
    }
    if (payload.price !== undefined) {
      updates.price = payload.price.toString();
    }
    if (payload.purchasedAt !== undefined) {
      updates.purchasedAt = payload.purchasedAt;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(tickets)
      .set(updates)
      .where(eq(tickets.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(tickets)
      .where(eq(tickets.id, id))
      .returning({ id: tickets.id });

    if (!deleted) {
      throw new NotFoundException(`Ticket ${id} not found`);
    }

    return deleted;
  }
}
