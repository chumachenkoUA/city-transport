import { Module } from '@nestjs/common';
import { DbModule } from '../db/db.module';
import { RoutesController } from './routes.controller';
import { RoutesService } from './routes.service';

@Module({
  imports: [DbModule],
  controllers: [RoutesController],
  providers: [RoutesService],
})
export class RoutesModule {}
