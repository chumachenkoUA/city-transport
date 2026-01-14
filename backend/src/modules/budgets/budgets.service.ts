import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { budgets } from '../../db/schema';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';

@Injectable()
export class BudgetsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(budgets);
  }

  async findOne(id: number) {
    const [budget] = await this.dbService.db
      .select()
      .from(budgets)
      .where(eq(budgets.id, id));

    if (!budget) {
      throw new NotFoundException(`Budget ${id} not found`);
    }

    return budget;
  }

  async findByMonth(month: string) {
    const [budget] = await this.dbService.db
      .select()
      .from(budgets)
      .where(eq(budgets.month, month));

    return budget ?? null;
  }

  async create(payload: CreateBudgetDto) {
    const [created] = await this.dbService.db
      .insert(budgets)
      .values({
        month: payload.month,
        plannedIncome: payload.plannedIncome.toString(),
        plannedExpenses: payload.plannedExpenses.toString(),
        note: payload.note,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateBudgetDto) {
    const updates: Partial<typeof budgets.$inferInsert> = {};

    if (payload.month !== undefined) {
      updates.month = payload.month;
    }
    if (payload.plannedIncome !== undefined) {
      updates.plannedIncome = payload.plannedIncome.toString();
    }
    if (payload.plannedExpenses !== undefined) {
      updates.plannedExpenses = payload.plannedExpenses.toString();
    }
    if (payload.note !== undefined) {
      updates.note = payload.note;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(budgets)
      .set(updates)
      .where(eq(budgets.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Budget ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(budgets)
      .where(eq(budgets.id, id))
      .returning({ id: budgets.id });

    if (!deleted) {
      throw new NotFoundException(`Budget ${id} not found`);
    }

    return deleted;
  }
}
