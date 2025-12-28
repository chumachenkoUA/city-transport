import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { RouteStopsController } from './route-stops.controller';
import { RouteStopsService } from './route-stops.service';

@Module({
  imports: [DbModule],
  controllers: [RouteStopsController],
  providers: [RouteStopsService],
})
export class RouteStopsModule {}
