import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DbService } from '../../db/db.service';
import { users } from '../../db/schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly dbService: DbService) {}

  private readonly userSelect = {
    id: users.id,
    login: users.login,
    email: users.email,
    phone: users.phone,
    fullName: users.fullName,
    registeredAt: users.registeredAt,
  };

  async findAll() {
    return this.dbService.db.select(this.userSelect).from(users);
  }

  async findOne(id: number) {
    const [user] = await this.dbService.db
      .select(this.userSelect)
      .from(users)
      .where(eq(users.id, id));

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return user;
  }

  async create(payload: CreateUserDto) {
    const [created] = await this.dbService.db
      .insert(users)
      .values({
        login: payload.login,
        email: payload.email,
        phone: payload.phone,
        fullName: payload.fullName,
      })
      .returning(this.userSelect);

    return created;
  }

  async update(id: number, payload: UpdateUserDto) {
    const updates: Partial<typeof users.$inferInsert> = {};

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

    if (Object.keys(updates).length === 0) {
      return this.findOne(id);
    }

    const [updated] = await this.dbService.db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning(this.userSelect);

    if (!updated) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return updated;
  }

  async remove(id: number) {
    const [deleted] = await this.dbService.db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });

    if (!deleted) {
      throw new NotFoundException(`User ${id} not found`);
    }

    return deleted;
  }
}
