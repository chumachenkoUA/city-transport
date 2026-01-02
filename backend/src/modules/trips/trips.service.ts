import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
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

  async findLatestByDriverAndVehicle(driverId: number, vehicleId: number) {
    const [trip] = await this.dbService.db
      .select()
      .from(trips)
      .where(and(eq(trips.driverId, driverId), eq(trips.vehicleId, vehicleId)))
      .orderBy(desc(trips.startsAt))
      .limit(1);

    return trip ?? null;
  }

  async findLatestByDriverVehicleOnDate(
    driverId: number,
    vehicleId: number,
    date: string,
  ) {
    const [trip] = await this.dbService.db
      .select()
      .from(trips)
      .where(
        and(
          eq(trips.driverId, driverId),
          eq(trips.vehicleId, vehicleId),
          sql`date(${trips.startsAt}) = ${date}`,
        ),
      )
      .orderBy(desc(trips.startsAt))
      .limit(1);

    return trip ?? null;
  }

  async getPassengerFlow(
    from: Date,
    to: Date,
    routeNumber?: string,
    transportTypeId?: number,
  ) {
    const conditions = [
      sql`t.starts_at >= ${from}`,
      sql`t.starts_at <= ${to}`,
    ];

    if (routeNumber) {
      conditions.push(sql`r.number = ${routeNumber}`);
    }
    if (transportTypeId) {
      conditions.push(sql`r.transport_type_id = ${transportTypeId}`);
    }

    const whereClause = sql.join(conditions, sql` and `);

    const result = (await this.dbService.db.execute(sql`
      select
        date(t.starts_at) as day,
        v.fleet_number as fleet_number,
        r.number as route_number,
        r.transport_type_id as transport_type_id,
        sum(t.passenger_count) as passenger_count
      from trips t
      inner join vehicles v on v.id = t.vehicle_id
      inner join routes r on r.id = t.route_id
      where ${whereClause}
      group by day, v.fleet_number, r.number, r.transport_type_id
      order by day, v.fleet_number
    `)) as unknown as {
      rows: Array<{
        day: string;
        fleet_number: string;
        route_number: string;
        transport_type_id: number;
        passenger_count: string;
      }>;
    };

    return result.rows;
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
