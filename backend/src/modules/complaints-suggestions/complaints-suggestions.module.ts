import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { ComplaintsSuggestionsController } from './complaints-suggestions.controller';
import { ComplaintsSuggestionsService } from './complaints-suggestions.service';

@Module({
  imports: [DbModule],
  controllers: [ComplaintsSuggestionsController],
  providers: [ComplaintsSuggestionsService],
})
export class ComplaintsSuggestionsModule {}
