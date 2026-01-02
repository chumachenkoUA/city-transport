import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { vehicles } from '../../db/schema';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(vehicles);
  }

  async findOne(id: number) {
    const [vehicle] = await this.dbService.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, id));

    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }

    return vehicle;
  }

  async findByFleetNumber(fleetNumber: string) {
    const [vehicle] = await this.dbService.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.fleetNumber, fleetNumber));

    return vehicle ?? null;
  }

  async findByRouteId(routeId: number) {
    return this.dbService.db
      .select()
      .from(vehicles)
      .where(eq(vehicles.routeId, routeId));
  }

  async create(payload: CreateVehicleDto) {
    const [created] = await this.dbService.db
      .insert(vehicles)
      .values({
        fleetNumber: payload.fleetNumber,
        transportTypeId: payload.transportTypeId,
        capacity: payload.capacity,
        routeId: payload.routeId,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateVehicleDto) {
    const updates: Partial<typeof vehicles.$inferInsert> = {};

    if (payload.fleetNumber !== undefined) {
      updates.fleetNumber = payload.fleetNumber;
    }
    if (payload.transportTypeId !== undefined) {
      updates.transportTypeId = payload.transportTypeId;
    }
    if (payload.capacity !== undefined) {
      updates.capacity = payload.capacity;
    }
    if (payload.routeId !== undefined) {
      updates.routeId = payload.routeId;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(vehicles)
      .set(updates)
      .where(eq(vehicles.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(vehicles)
      .where(eq(vehicles.id, id))
      .returning({ id: vehicles.id });

    if (!deleted) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }

    return deleted;
  }
}
