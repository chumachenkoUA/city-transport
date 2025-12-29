import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
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
