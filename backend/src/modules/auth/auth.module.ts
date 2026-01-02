import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DbModule } from '../../db/db.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [DbModule, ConfigModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
