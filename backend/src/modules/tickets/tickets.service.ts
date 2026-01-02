import { Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import {
  routes,
  tickets,
  transportCards,
  transportTypes,
  trips,
} from '../../db/schema';
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

  async findLastTripByCardId(cardId: number) {
    const [lastTrip] = await this.dbService.db
      .select({
        cardId: transportCards.id,
        cardNumber: transportCards.cardNumber,
        tripId: tickets.tripId,
        purchasedAt: tickets.purchasedAt,
        routeId: trips.routeId,
        routeNumber: routes.number,
        transportType: transportTypes.name,
        vehicleId: trips.vehicleId,
        driverId: trips.driverId,
      })
      .from(tickets)
      .innerJoin(transportCards, eq(transportCards.id, tickets.cardId))
      .innerJoin(trips, eq(trips.id, tickets.tripId))
      .innerJoin(routes, eq(routes.id, trips.routeId))
      .innerJoin(transportTypes, eq(transportTypes.id, routes.transportTypeId))
      .where(eq(tickets.cardId, cardId))
      .orderBy(desc(tickets.purchasedAt))
      .limit(1);

    return lastTrip ?? null;
  }

  async findTripsByUserId(userId: number) {
    return this.dbService.db
      .select({
        ticketId: tickets.id,
        purchasedAt: tickets.purchasedAt,
        price: tickets.price,
        tripId: trips.id,
        startsAt: trips.startsAt,
        endsAt: trips.endsAt,
        routeId: routes.id,
        routeNumber: routes.number,
        transportType: transportTypes.name,
      })
      .from(transportCards)
      .innerJoin(tickets, eq(tickets.cardId, transportCards.id))
      .innerJoin(trips, eq(trips.id, tickets.tripId))
      .innerJoin(routes, eq(routes.id, trips.routeId))
      .innerJoin(transportTypes, eq(transportTypes.id, routes.transportTypeId))
      .where(eq(transportCards.userId, userId))
      .orderBy(desc(tickets.purchasedAt));
  }

  async sumByPeriod(from: Date, to: Date) {
    const result = (await this.dbService.db.execute(sql`
      select coalesce(sum(price), 0) as total
      from tickets
      where purchased_at >= ${from} and purchased_at <= ${to}
    `)) as unknown as {
      rows: Array<{ total: string }>;
    };

    return result.rows[0]?.total ?? '0';
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
