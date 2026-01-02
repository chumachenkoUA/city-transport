import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { Client } from 'pg';
import { DbService } from '../../db/db.service';
import { users } from '../../db/schema';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly dbService: DbService,
    private readonly configService: ConfigService,
  ) {}

  private readonly userSelect = {
    id: users.id,
    login: users.login,
    email: users.email,
    phone: users.phone,
    fullName: users.fullName,
    registeredAt: users.registeredAt,
  };

  async register(payload: RegisterDto) {
    try {
      await this.dbService.db.execute(sql`
        SELECT auth.register_passenger(
          ${payload.login},
          ${payload.password},
          ${payload.email},
          ${payload.phone},
          ${payload.fullName}
        )
      `);
    } catch (error) {
      throw new ConflictException(
        (error as Error).message || 'Registration failed',
      );
    }

    const [created] = await this.dbService.db
      .select(this.userSelect)
      .from(users)
      .where(sql`${users.login} = ${payload.login}`)
      .limit(1);

    return created ?? null;
  }

  async login(payload: LoginDto) {
    const connectionString = this.configService.get<string>('DATABASE_URL');
    if (!connectionString) {
      throw new UnauthorizedException('Database config is missing');
    }

    const url = new URL(connectionString);
    const client = new Client({
      host: url.hostname,
      port: url.port ? Number(url.port) : 5432,
      database: url.pathname.replace(/^\//, ''),
      user: payload.login,
      password: payload.password,
    });

    type DbUserRow = {
      id: number;
      login: string;
      email: string;
      phone: string;
      full_name: string;
      registered_at: Date;
    };

    try {
      await client.connect();
    } catch {
      throw new UnauthorizedException('Invalid credentials');
    }

    try {
      let user: {
        id: number;
        login: string;
        email: string;
        phone: string;
        fullName: string;
        registeredAt: Date;
      } | null = null;

      try {
        const userResult = await client.query<DbUserRow>(
          `
            select id, login, email, phone, full_name, registered_at
            from users
            where login = current_user
          `,
        );
        const userRow = userResult.rows[0];
        if (userRow) {
          user = {
            id: userRow.id,
            login: userRow.login,
            email: userRow.email,
            phone: userRow.phone,
            fullName: userRow.full_name,
            registeredAt: userRow.registered_at,
          };
        }
      } catch {
        user = null;
      }

      const rolesResult = await client.query<{ rolname: string }>(
        `
          select rolname
          from pg_roles
          where pg_has_role(current_user, oid, 'member')
            and rolname like 'ct_%'
        `,
      );

      return {
        ok: true,
        user,
        roles: rolesResult.rows.map((row) => row.rolname),
      };
    } finally {
      await client.end().catch(() => undefined);
    }
  }
}
