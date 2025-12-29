import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { FineAppealsController } from './fine-appeals.controller';
import { FineAppealsService } from './fine-appeals.service';

@Module({
  imports: [DbModule],
  controllers: [FineAppealsController],
  providers: [FineAppealsService],
})
export class FineAppealsModule {}
