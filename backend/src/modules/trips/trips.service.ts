import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import {
  driverVehicleAssignments,
  routes,
  transportTypes,
  trips,
  vehicles,
} from '../../db/schema';
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

  async findLatestByDriver(driverId: number) {
    const [trip] = await this.dbService.db
      .select()
      .from(trips)
      .where(eq(trips.driverId, driverId))
      .orderBy(desc(trips.plannedStartsAt))
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
        plannedStartsAt: trips.plannedStartsAt,
        plannedEndsAt: trips.plannedEndsAt,
        actualStartsAt: trips.actualStartsAt,
        actualEndsAt: trips.actualEndsAt,
        status: trips.status,
        routeId: routes.id,
        routeNumber: routes.number,
        routeDirection: routes.direction,
        transportTypeId: routes.transportTypeId,
        transportTypeName: transportTypes.name,
        vehicleId: driverVehicleAssignments.vehicleId,
        fleetNumber: vehicles.fleetNumber,
      })
      .from(trips)
      .innerJoin(routes, eq(routes.id, trips.routeId))
      .leftJoin(
        driverVehicleAssignments,
        eq(driverVehicleAssignments.driverId, trips.driverId),
      )
      .leftJoin(vehicles, eq(vehicles.id, driverVehicleAssignments.vehicleId))
      .innerJoin(transportTypes, eq(transportTypes.id, routes.transportTypeId))
      .where(
        and(
          eq(trips.driverId, driverId),
          gte(trips.plannedStartsAt, startOfDay),
          lt(trips.plannedStartsAt, endOfDay),
        ),
      )
      .orderBy(trips.plannedStartsAt);
  }

  async findActiveByDriver(driverId: number) {
    const [trip] = await this.dbService.db
      .select()
      .from(trips)
      .where(and(eq(trips.driverId, driverId), eq(trips.status, 'in_progress')))
      .orderBy(desc(trips.actualStartsAt))
      .limit(1);

    return trip ?? null;
  }

  async findLatestByDriverOnDate(driverId: number, date: string) {
    const startOfDay = new Date(`${date}T00:00:00`);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const [trip] = await this.dbService.db
      .select()
      .from(trips)
      .where(
        and(
          eq(trips.driverId, driverId),
          gte(trips.plannedStartsAt, startOfDay),
          lt(trips.plannedStartsAt, endOfDay),
        ),
      )
      .orderBy(desc(trips.plannedStartsAt))
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
    void checkedAt; // Not used with status-based model

    if (fleetNumber) {
      // Find vehicle and its assigned driver
      const [vehicle] = await this.dbService.db
        .select({
          id: vehicles.id,
          driverId: driverVehicleAssignments.driverId,
        })
        .from(vehicles)
        .leftJoin(
          driverVehicleAssignments,
          eq(driverVehicleAssignments.vehicleId, vehicles.id),
        )
        .where(eq(vehicles.fleetNumber, fleetNumber))
        .limit(1);

      if (!vehicle || !vehicle.driverId) {
        return null;
      }

      const conditions = [
        eq(trips.driverId, vehicle.driverId),
        eq(trips.status, 'in_progress'),
      ];

      if (routeNumber) {
        conditions.push(eq(routes.number, routeNumber));
      }

      const activeTrips = await this.dbService.db
        .select({
          id: trips.id,
          routeId: trips.routeId,
          driverId: trips.driverId,
          plannedStartsAt: trips.plannedStartsAt,
          plannedEndsAt: trips.plannedEndsAt,
          actualStartsAt: trips.actualStartsAt,
          actualEndsAt: trips.actualEndsAt,
          status: trips.status,
        })
        .from(trips)
        .innerJoin(routes, eq(routes.id, trips.routeId))
        .where(and(...conditions))
        .orderBy(desc(trips.actualStartsAt))
        .limit(2);

      if (activeTrips.length > 1) {
        throw new ConflictException('Multiple active trips found for driver');
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
        driverId: trips.driverId,
        plannedStartsAt: trips.plannedStartsAt,
        plannedEndsAt: trips.plannedEndsAt,
        actualStartsAt: trips.actualStartsAt,
        actualEndsAt: trips.actualEndsAt,
        status: trips.status,
      })
      .from(trips)
      .innerJoin(routes, eq(routes.id, trips.routeId))
      .where(
        and(eq(routes.number, routeNumber), eq(trips.status, 'in_progress')),
      )
      .orderBy(desc(trips.actualStartsAt))
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
      sql`t.actual_starts_at >= ${from}`,
      sql`t.actual_starts_at <= ${to}`,
      sql`t.status = 'completed'`,
    ];

    if (routeNumber) {
      conditions.push(sql`r.number = ${routeNumber}`);
    }
    if (transportTypeId) {
      conditions.push(sql`r.transport_type_id = ${transportTypeId}`);
    }

    const whereClause = sql.join(conditions, sql.raw(' and '));

    const result = (await this.dbService.db.execute(sql`
      select
        date(t.actual_starts_at) as day,
        v.fleet_number as fleet_number,
        r.number as route_number,
        r.transport_type_id as transport_type_id,
        sum(t.passenger_count) as passenger_count
      from trips t
      inner join routes r on r.id = t.route_id
      left join driver_vehicle_assignments dva on dva.driver_id = t.driver_id
      left join vehicles v on v.id = dva.vehicle_id
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
        driverId: payload.driverId,
        plannedStartsAt: payload.plannedStartsAt,
        plannedEndsAt: payload.plannedEndsAt,
        status: payload.status ?? 'scheduled',
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
    if (payload.driverId !== undefined) {
      updates.driverId = payload.driverId;
    }
    if (payload.plannedStartsAt !== undefined) {
      updates.plannedStartsAt = payload.plannedStartsAt;
    }
    if (payload.plannedEndsAt !== undefined) {
      updates.plannedEndsAt = payload.plannedEndsAt;
    }
    if (payload.actualStartsAt !== undefined) {
      updates.actualStartsAt = payload.actualStartsAt;
    }
    if (payload.actualEndsAt !== undefined) {
      updates.actualEndsAt = payload.actualEndsAt;
    }
    if (payload.status !== undefined) {
      updates.status = payload.status;
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
