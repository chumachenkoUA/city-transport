import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthSessionMiddleware } from './auth-session.middleware';
import { RedisService } from './redis.service';
import { RequestContextService } from './request-context.service';
import { SessionService } from './session.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    RedisService,
    SessionService,
    RequestContextService,
    AuthSessionMiddleware,
  ],
  exports: [RedisService, SessionService, RequestContextService],
})
export class SessionModule {}
