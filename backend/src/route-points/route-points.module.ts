import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { RoutePointsController } from './route-points.controller';
import { RoutePointsService } from './route-points.service';

@Module({
  imports: [DbModule],
  controllers: [RoutePointsController],
  providers: [RoutePointsService],
})
export class RoutePointsModule {}
