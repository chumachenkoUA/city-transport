import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateComplaintSuggestionDto } from './dto/create-complaint-suggestion.dto';
import { UpdateComplaintSuggestionDto } from './dto/update-complaint-suggestion.dto';
import { ComplaintsSuggestionsService } from './complaints-suggestions.service';

@Controller('complaints-suggestions')
export class ComplaintsSuggestionsController {
  constructor(
    private readonly complaintsSuggestionsService: ComplaintsSuggestionsService,
  ) {}

  @Get()
  findAll() {
    return this.complaintsSuggestionsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.complaintsSuggestionsService.findOne(id);
  }

  @Post()
  create(@Body() payload: CreateComplaintSuggestionDto) {
    return this.complaintsSuggestionsService.create(payload);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateComplaintSuggestionDto,
  ) {
    return this.complaintsSuggestionsService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.complaintsSuggestionsService.remove(id);
  }
}
