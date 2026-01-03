import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { drivers } from '../../db/schema';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';

@Injectable()
export class DriversService {
  constructor(private readonly dbService: DbService) {}

  async findAll() {
    return this.dbService.db.select().from(drivers);
  }

  async findOne(id: number) {
    const [driver] = await this.dbService.db
      .select()
      .from(drivers)
      .where(eq(drivers.id, id));

    if (!driver) {
      throw new NotFoundException(`Driver ${id} not found`);
    }

    return driver;
  }

  async findByLogin(login: string) {
    const [driver] = await this.dbService.db
      .select()
      .from(drivers)
      .where(eq(drivers.login, login));

    if (!driver) {
      throw new NotFoundException(`Driver ${login} not found`);
    }

    return driver;
  }

  async create(payload: CreateDriverDto) {
    const [created] = await this.dbService.db
      .insert(drivers)
      .values({
        login: payload.login,
        email: payload.email,
        phone: payload.phone,
        fullName: payload.fullName,
        driverLicenseNumber: payload.driverLicenseNumber,
        licenseCategories: payload.licenseCategories,
        passportData: payload.passportData,
      })
      .returning();

    return created;
  }

  async update(id: number, payload: UpdateDriverDto) {
    const updates: Partial<typeof drivers.$inferInsert> = {};

    if (payload.email !== undefined) {
      updates.email = payload.email;
    }
    if (payload.login !== undefined) {
      updates.login = payload.login;
    }
    if (payload.phone !== undefined) {
      updates.phone = payload.phone;
    }
    if (payload.fullName !== undefined) {
      updates.fullName = payload.fullName;
    }
    if (payload.driverLicenseNumber !== undefined) {
      updates.driverLicenseNumber = payload.driverLicenseNumber;
    }
    if (payload.licenseCategories !== undefined) {
      updates.licenseCategories = payload.licenseCategories;
    }
    if (payload.passportData !== undefined) {
      updates.passportData = payload.passportData;
    }

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(drivers)
      .set(updates)
      .where(eq(drivers.id, id))
      .returning();

    if (!updated) {
      throw new NotFoundException(`Driver ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(drivers)
      .where(eq(drivers.id, id))
      .returning({ id: drivers.id });

    if (!deleted) {
      throw new NotFoundException(`Driver ${id} not found`);
    }

    return deleted;
  }
}
