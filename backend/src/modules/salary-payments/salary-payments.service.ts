import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { salaryPayments } from '../../db/schema';
import { CreateSalaryPaymentDto } from './dto/create-salary-payment.dto';
import { UpdateSalaryPaymentDto } from './dto/update-salary-payment.dto';

@Injectable()
export class SalaryPaymentsService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(salaryPayments);
  }

  async findOne(id: number) {
    const [payment] = await this.dbService.db
      .select()
      .from(salaryPayments)
      .where(eq(salaryPayments.id, id));

    if (!payment) {
      throw new NotFoundException(`Salary payment ${id} not found`);
    }

    return payment;
  }

  async findByPeriod(from: Date, to: Date, role?: string) {
    const conditions = [
      gte(salaryPayments.paidAt, from),
      lte(salaryPayments.paidAt, to),
    ];

    if (role) {
      conditions.push(eq(salaryPayments.employeeRole, role));
    }

    return this.dbService.db
      .select()
      .from(salaryPayments)
      .where(and(...conditions))
      .orderBy(desc(salaryPayments.paidAt));
  }

  async sumByPeriod(from: Date, to: Date) {
    const result = (await this.dbService.db.execute(sql`
      select coalesce(sum(total), 0) as total
      from salary_payments
      where paid_at >= ${from} and paid_at <= ${to}
    `)) as unknown as {
      rows: Array<{ total: string }>;
    };

    return result.rows[0]?.total ?? '0';
  }

  async create(payload: CreateSalaryPaymentDto) {
    if (!payload.driverId && !payload.employeeName) {
      throw new BadRequestException(
        'driverId or employeeName is required for salary payment',
      );
    }

    const [created] = await this.dbService.db
      .insert(salaryPayments)
      .values({
        driverId: payload.driverId,
        employeeName: payload.employeeName,
        employeeRole: payload.employeeRole,
        rate: payload.rate?.toString(),
        units: payload.units,
        total: payload.total.toString(),
        paidAt: payload.paidAt,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateSalaryPaymentDto) {
    const updates: Partial<typeof salaryPayments.$inferInsert> = {};

    if (payload.driverId !== undefined) {
      updates.driverId = payload.driverId;
    }
    if (payload.employeeName !== undefined) {
      updates.employeeName = payload.employeeName;
    }
    if (payload.employeeRole !== undefined) {
      updates.employeeRole = payload.employeeRole;
    }
    if (payload.rate !== undefined) {
      updates.rate = payload.rate.toString();
    }
    if (payload.units !== undefined) {
      updates.units = payload.units;
    }
    if (payload.total !== undefined) {
      updates.total = payload.total.toString();
    }
    if (payload.paidAt !== undefined) {
      updates.paidAt = payload.paidAt;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(salaryPayments)
      .set(updates)
      .where(eq(salaryPayments.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Salary payment ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(salaryPayments)
      .where(eq(salaryPayments.id, id))
      .returning({ id: salaryPayments.id });

    if (!deleted) {
      throw new NotFoundException(`Salary payment ${id} not found`);
    }

    return deleted;
  }
}
