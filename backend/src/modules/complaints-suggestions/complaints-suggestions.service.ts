import { Injectable, NotFoundException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { complaintsSuggestions } from '../../db/schema';
import { CreateComplaintSuggestionDto } from './dto/create-complaint-suggestion.dto';
import { UpdateComplaintSuggestionDto } from './dto/update-complaint-suggestion.dto';

@Injectable()
export class ComplaintsSuggestionsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(complaintsSuggestions);
  }

  async findOne(id: number) {
    const [item] = await this.dbService.db
      .select()
      .from(complaintsSuggestions)
      .where(eq(complaintsSuggestions.id, id));

    if (!item) {
      throw new NotFoundException(`Complaint/suggestion ${id} not found`);
    }

    return item;
  }

  async findByPeriod(
    from: Date,
    to: Date,
    routeNumber?: string,
    transportTypeId?: number,
    fleetNumber?: string,
  ) {
    const conditions = [
      sql`coalesce(cs.created_at, t.starts_at) >= ${from}`,
      sql`coalesce(cs.created_at, t.starts_at) <= ${to}`,
    ];

    if (routeNumber) {
      conditions.push(sql`r.number = ${routeNumber}`);
    }
    if (transportTypeId) {
      conditions.push(sql`r.transport_type_id = ${transportTypeId}`);
    }
    if (fleetNumber) {
      conditions.push(sql`v.fleet_number = ${fleetNumber}`);
    }

    const whereClause = sql.join(conditions, sql` and `);

    const result = (await this.dbService.db.execute(sql`
      select
        cs.id,
        cs.user_id,
        cs.type,
        cs.message,
        cs.status,
        cs.trip_id,
        cs.created_at,
        r.number as route_number,
        r.transport_type_id as transport_type_id,
        tt.name as transport_type,
        v.fleet_number as fleet_number
      from complaints_suggestions cs
      left join trips t on t.id = cs.trip_id
      left join routes r on r.id = t.route_id
      left join vehicles v on v.id = t.vehicle_id
      left join transport_types tt on tt.id = r.transport_type_id
      where ${whereClause}
      order by cs.created_at desc nulls last, t.starts_at desc nulls last
    `)) as unknown as {
      rows: Array<{
        id: number;
        user_id: number;
        type: string;
        message: string;
        status: string;
        trip_id: number | null;
        created_at: Date | null;
        route_number: string | null;
        transport_type_id: number | null;
        transport_type: string | null;
        fleet_number: string | null;
      }>;
    };

    return result.rows;
  }

  async create(payload: CreateComplaintSuggestionDto) {
    const [created] = await this.dbService.db
      .insert(complaintsSuggestions)
      .values({
        userId: payload.userId,
        type: payload.type,
        message: payload.message,
        tripId: payload.tripId,
        status: payload.status,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateComplaintSuggestionDto) {
    const updates: Partial<typeof complaintsSuggestions.$inferInsert> = {};

    if (payload.userId !== undefined) {
      updates.userId = payload.userId;
    }
    if (payload.type !== undefined) {
      updates.type = payload.type;
    }
    if (payload.message !== undefined) {
      updates.message = payload.message;
    }
    if (payload.tripId !== undefined) {
      updates.tripId = payload.tripId;
    }
    if (payload.status !== undefined) {
      updates.status = payload.status;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(complaintsSuggestions)
      .set(updates)
      .where(eq(complaintsSuggestions.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Complaint/suggestion ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(complaintsSuggestions)
      .where(eq(complaintsSuggestions.id, id))
      .returning({ id: complaintsSuggestions.id });

    if (!deleted) {
      throw new NotFoundException(`Complaint/suggestion ${id} not found`);
    }

    return deleted;
  }
}
