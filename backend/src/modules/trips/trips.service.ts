import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, gte, isNull, lt, lte, or, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { routes, transportTypes, trips, vehicles } from '../../db/schema';
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

  async findByDriverOnDate(driverId: number, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    return this.dbService.db
      .select({
        id: trips.id,
        startsAt: trips.startsAt,
        endsAt: trips.endsAt,
        routeId: routes.id,
        routeNumber: routes.number,
        routeDirection: routes.direction,
        transportTypeId: routes.transportTypeId,
        transportTypeName: transportTypes.name,
        vehicleId: vehicles.id,
        fleetNumber: vehicles.fleetNumber,
      })
      .from(trips)
      .innerJoin(routes, eq(routes.id, trips.routeId))
      .innerJoin(vehicles, eq(vehicles.id, trips.vehicleId))
      .innerJoin(transportTypes, eq(transportTypes.id, routes.transportTypeId))
      .where(
        and(
          eq(trips.driverId, driverId),
          gte(trips.startsAt, startOfDay),
          lt(trips.startsAt, endOfDay),
        ),
      )
      .orderBy(trips.startsAt);
  }

  async findActiveByDriver(driverId: number, at?: Date) {
    const timestamp = at ?? new Date();
    const [trip] = await this.dbService.db
      .select()
      .from(trips)
      .where(
        and(
          eq(trips.driverId, driverId),
          lte(trips.startsAt, timestamp),
          or(isNull(trips.endsAt), gte(trips.endsAt, timestamp)),
        ),
      )
      .orderBy(desc(trips.startsAt))
      .limit(1);

    return trip ?? null;
  }

  async findLatestByDriverVehicleOnDate(
    driverId: number,
    vehicleId: number,
    date: string,
  ) {
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const [trip] = await this.dbService.db
      .select()
      .from(trips)
      .where(
        and(
          eq(trips.driverId, driverId),
          eq(trips.vehicleId, vehicleId),
          gte(trips.startsAt, startOfDay),
          lt(trips.startsAt, endOfDay),
        ),
      )
      .orderBy(desc(trips.startsAt))
      .limit(1);

    return trip ?? null;
  }

  async findActiveTrip({
    fleetNumber,
    routeNumber,
    checkedAt,
  }: {
    fleetNumber?: string;
    routeNumber?: string;
    checkedAt?: Date;
  }) {
    const timestamp = checkedAt ?? new Date();

    if (fleetNumber) {
      const [vehicle] = await this.dbService.db
        .select({ id: vehicles.id })
        .from(vehicles)
        .where(eq(vehicles.fleetNumber, fleetNumber))
        .limit(1);

      if (!vehicle) {
        return null;
      }

      const conditions = [
        eq(trips.vehicleId, vehicle.id),
        lte(trips.startsAt, timestamp),
        or(isNull(trips.endsAt), gte(trips.endsAt, timestamp)),
      ];

      if (routeNumber) {
        conditions.push(eq(routes.number, routeNumber));
      }

      const activeTrips = await this.dbService.db
        .select({
          id: trips.id,
          routeId: trips.routeId,
          vehicleId: trips.vehicleId,
          driverId: trips.driverId,
          startsAt: trips.startsAt,
          endsAt: trips.endsAt,
        })
        .from(trips)
        .innerJoin(routes, eq(routes.id, trips.routeId))
        .where(and(...conditions))
        .orderBy(desc(trips.startsAt))
        .limit(2);

      if (activeTrips.length > 1) {
        throw new ConflictException('Multiple active trips found for vehicle');
      }

      return activeTrips[0] ?? null;
    }

    if (!routeNumber) {
      return null;
    }

    const [trip] = await this.dbService.db
      .select({
        id: trips.id,
        routeId: trips.routeId,
        vehicleId: trips.vehicleId,
        driverId: trips.driverId,
        startsAt: trips.startsAt,
        endsAt: trips.endsAt,
      })
      .from(trips)
      .innerJoin(vehicles, eq(vehicles.id, trips.vehicleId))
      .innerJoin(routes, eq(routes.id, trips.routeId))
      .where(
        and(
          eq(routes.number, routeNumber),
          lte(trips.startsAt, timestamp),
          or(isNull(trips.endsAt), gte(trips.endsAt, timestamp)),
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
    const conditions = [sql`t.starts_at >= ${from}`, sql`t.starts_at <= ${to}`];

    if (routeNumber) {
      conditions.push(sql`r.number = ${routeNumber}`);
    }
    if (transportTypeId) {
      conditions.push(sql`r.transport_type_id = ${transportTypeId}`);
    }

    const whereClause = sql.join(conditions, sql.raw(' and '));

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

  async startByDriverLogin(payload: {
    login: string;
    fleetNumber: string;
    startedAt?: Date;
    direction?: string;
  }) {
    const startedAt = payload.startedAt ?? new Date();
    const direction = payload.direction ?? 'forward';
    void payload.login;

    const result = await this.dbService.db.execute(sql`
      select driver_api.start_trip(
        ${payload.fleetNumber},
        ${startedAt},
        ${direction}
      ) as trip_id
    `);

    const tripId = Number(result.rows?.[0]?.trip_id ?? 0);
    if (!tripId) {
      throw new ConflictException('Failed to start trip');
    }

    return this.findOne(tripId);
  }

  async finishByDriverLogin(payload: { login: string; endedAt?: Date }) {
    const endedAt = payload.endedAt ?? new Date();
    void payload.login;

    const result = await this.dbService.db.execute(sql`
      select driver_api.finish_trip(${endedAt}) as trip_id
    `);

    const tripId = Number(result.rows?.[0]?.trip_id ?? 0);
    if (!tripId) {
      throw new ConflictException('Failed to finish trip');
    }

    return this.findOne(tripId);
  }
}
