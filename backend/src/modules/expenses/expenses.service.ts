import { Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { expenses } from '../../db/schema';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(expenses);
  }

  async findOne(id: number) {
    const [expense] = await this.dbService.db
      .select()
      .from(expenses)
      .where(eq(expenses.id, id));

    if (!expense) {
      throw new NotFoundException(`Expense ${id} not found`);
    }

    return expense;
  }

  async findByPeriod(from: Date, to: Date, category?: string) {
    const conditions = [
      gte(expenses.occurredAt, from),
      lte(expenses.occurredAt, to),
    ];

    if (category) {
      conditions.push(eq(expenses.category, category));
    }

    return this.dbService.db
      .select()
      .from(expenses)
      .where(and(...conditions))
      .orderBy(desc(expenses.occurredAt));
  }

  async sumByPeriod(from: Date, to: Date) {
    const result = (await this.dbService.db.execute(sql`
      select coalesce(sum(amount), 0) as total
      from expenses
      where occurred_at >= ${from} and occurred_at <= ${to}
    `)) as unknown as {
      rows: Array<{ total: string }>;
    };

    return result.rows[0]?.total ?? '0';
  }

  async create(payload: CreateExpenseDto) {
    const [created] = await this.dbService.db
      .insert(expenses)
      .values({
        category: payload.category,
        amount: payload.amount.toString(),
        description: payload.description,
        occurredAt: payload.occurredAt,
        documentRef: payload.documentRef,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateExpenseDto) {
    const updates: Partial<typeof expenses.$inferInsert> = {};

    if (payload.category !== undefined) {
      updates.category = payload.category;
    }
    if (payload.amount !== undefined) {
      updates.amount = payload.amount.toString();
    }
    if (payload.description !== undefined) {
      updates.description = payload.description;
    }
    if (payload.occurredAt !== undefined) {
      updates.occurredAt = payload.occurredAt;
    }
    if (payload.documentRef !== undefined) {
      updates.documentRef = payload.documentRef;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(expenses)
      .set(updates)
      .where(eq(expenses.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Expense ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(expenses)
      .where(eq(expenses.id, id))
      .returning({ id: expenses.id });

    if (!deleted) {
      throw new NotFoundException(`Expense ${id} not found`);
    }

    return deleted;
  }
}
