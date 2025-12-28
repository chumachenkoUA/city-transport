import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { UserGpsLogsController } from './user-gps-logs.controller';
import { UserGpsLogsService } from './user-gps-logs.service';

@Module({
  imports: [DbModule],
  controllers: [UserGpsLogsController],
  providers: [UserGpsLogsService],
})
export class UserGpsLogsModule {}
