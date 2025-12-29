import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { driverVehicleAssignments } from '../../db/schema';
import { CreateDriverVehicleAssignmentDto } from './dto/create-driver-vehicle-assignment.dto';
import { UpdateDriverVehicleAssignmentDto } from './dto/update-driver-vehicle-assignment.dto';

@Injectable()
export class DriverVehicleAssignmentsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(driverVehicleAssignments);
  }

  async findOne(id: number) {
    const [assignment] = await this.dbService.db
      .select()
      .from(driverVehicleAssignments)
      .where(eq(driverVehicleAssignments.id, id));

    if (!assignment) {
      throw new NotFoundException(`Assignment ${id} not found`);
    }

    return assignment;
  }

  async create(payload: CreateDriverVehicleAssignmentDto) {
    const [created] = await this.dbService.db
      .insert(driverVehicleAssignments)
      .values({
        driverId: payload.driverId,
        vehicleId: payload.vehicleId,
        assignedAt: payload.assignedAt,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateDriverVehicleAssignmentDto) {
    const updates: Partial<typeof driverVehicleAssignments.$inferInsert> = {};

    if (payload.driverId !== undefined) {
      updates.driverId = payload.driverId;
    }
    if (payload.vehicleId !== undefined) {
      updates.vehicleId = payload.vehicleId;
    }
    if (payload.assignedAt !== undefined) {
      updates.assignedAt = payload.assignedAt;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(driverVehicleAssignments)
      .set(updates)
      .where(eq(driverVehicleAssignments.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Assignment ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(driverVehicleAssignments)
      .where(eq(driverVehicleAssignments.id, id))
      .returning({ id: driverVehicleAssignments.id });

    if (!deleted) {
      throw new NotFoundException(`Assignment ${id} not found`);
    }

    return deleted;
  }
}
