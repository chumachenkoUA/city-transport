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
import { CreateFineAppealDto } from './dto/create-fine-appeal.dto';
import { UpdateFineAppealDto } from './dto/update-fine-appeal.dto';
import { FineAppealsService } from './fine-appeals.service';

@Controller('fine-appeals')
export class FineAppealsController {
  constructor(private readonly fineAppealsService: FineAppealsService) {}

  @Get()
  findAll() {
    return this.fineAppealsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.fineAppealsService.findOne(id);
  }

  @Post()
  create(@Body() payload: CreateFineAppealDto) {
    return this.fineAppealsService.create(payload);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateFineAppealDto,
  ) {
    return this.fineAppealsService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.fineAppealsService.remove(id);
  }
}
