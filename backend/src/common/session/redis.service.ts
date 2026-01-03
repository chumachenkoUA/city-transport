import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type RedisClientType } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: RedisClientType;

  constructor(private readonly configService: ConfigService) {
    const redisUrl =
      this.configService.get<string>('REDIS_URL') ??
      (this.configService.get<string>('REDIS_PASSWORD')
        ? `redis://:${this.configService.get<string>('REDIS_PASSWORD')}@localhost:6379`
        : 'redis://localhost:6379');

    this.client = createClient({ url: redisUrl });
    this.client.on('error', (error) => {
      console.error('Redis error', error);
    });
  }

  async onModuleInit(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }
}
