import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { trips } from '../../db/schema';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripDto } from './dto/update-trip.dto';

@Injectable()
export class TripsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(trips);
  }

  async findOne(id: number) {
    const [trip] = await this.dbService.db
      .select()
      .from(trips)
      .where(eq(trips.id, id));

    if (!trip) {
      throw new NotFoundException(`Trip ${id} not found`);
    }

    return trip;
  }

  async create(payload: CreateTripDto) {
    const [created] = await this.dbService.db
      .insert(trips)
      .values({
        routeId: payload.routeId,
        vehicleId: payload.vehicleId,
        driverId: payload.driverId,
        startsAt: payload.startsAt,
        endsAt: payload.endsAt,
        passengerCount: payload.passengerCount ?? 0,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateTripDto) {
    const updates: Partial<typeof trips.$inferInsert> = {};

    if (payload.routeId !== undefined) {
      updates.routeId = payload.routeId;
    }
    if (payload.vehicleId !== undefined) {
      updates.vehicleId = payload.vehicleId;
    }
    if (payload.driverId !== undefined) {
      updates.driverId = payload.driverId;
    }
    if (payload.startsAt !== undefined) {
      updates.startsAt = payload.startsAt;
    }
    if (payload.endsAt !== undefined) {
      updates.endsAt = payload.endsAt;
    }
    if (payload.passengerCount !== undefined) {
      updates.passengerCount = payload.passengerCount;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(trips)
      .set(updates)
      .where(eq(trips.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Trip ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(trips)
      .where(eq(trips.id, id))
      .returning({ id: trips.id });

    if (!deleted) {
      throw new NotFoundException(`Trip ${id} not found`);
    }

    return deleted;
  }
}
