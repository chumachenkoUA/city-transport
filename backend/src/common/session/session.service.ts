import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { RedisService } from './redis.service';

export type SessionUser = {
  id?: number;
  login: string;
  fullName?: string;
  email?: string;
  phone?: string;
  registeredAt?: string;
};

export type AuthSession = {
  login: string;
  password: string;
  roles: string[];
  user: SessionUser | null;
};

export type StoredSession = AuthSession & {
  token: string;
};

const SESSION_PREFIX = 'ct:session:';

@Injectable()
export class SessionService {
  private readonly ttlSeconds: number;

  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {
    const ttl = Number(this.configService.get('SESSION_TTL_SECONDS'));
    this.ttlSeconds = Number.isFinite(ttl) && ttl > 0 ? ttl : 60 * 60 * 6;
  }

  async createSession(session: AuthSession) {
    const token = randomUUID();
    const key = `${SESSION_PREFIX}${token}`;
    await this.redisService.client.set(key, JSON.stringify(session), {
      EX: this.ttlSeconds,
    });

    return {
      token,
      expiresIn: this.ttlSeconds,
    };
  }

  async getSession(token: string): Promise<StoredSession | null> {
    if (!token) {
      return null;
    }

    const key = `${SESSION_PREFIX}${token}`;
    const raw = await this.redisService.client.get(key);
    if (!raw) {
      return null;
    }

    try {
      const session = JSON.parse(raw) as AuthSession;
      return { token, ...session };
    } catch {
      return null;
    }
  }

  async deleteSession(token: string): Promise<void> {
    if (!token) {
      return;
    }

    const key = `${SESSION_PREFIX}${token}`;
    await this.redisService.client.del(key);
  }
}
