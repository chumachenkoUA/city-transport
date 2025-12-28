import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../db/db.service';
import { transportTypes } from '../db/schema';
import { CreateTransportTypeDto } from './dto/create-transport-type.dto';
import { UpdateTransportTypeDto } from './dto/update-transport-type.dto';

@Injectable()
export class TransportTypesService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(transportTypes);
  }

  async findOne(id: number) {
    const [type] = await this.dbService.db
      .select()
      .from(transportTypes)
      .where(eq(transportTypes.id, id));

    if (!type) {
      throw new NotFoundException(`Transport type ${id} not found`);
    }

    return type;
  }

  async create(payload: CreateTransportTypeDto) {
    const [created] = await this.dbService.db
      .insert(transportTypes)
      .values({ name: payload.name })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateTransportTypeDto) {
    const updates: Partial<typeof transportTypes.$inferInsert> = {};

    if (payload.name !== undefined) {
      updates.name = payload.name;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(transportTypes)
      .set(updates)
      .where(eq(transportTypes.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Transport type ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(transportTypes)
      .where(eq(transportTypes.id, id))
      .returning({ id: transportTypes.id });

    if (!deleted) {
      throw new NotFoundException(`Transport type ${id} not found`);
    }

    return deleted;
  }
}
