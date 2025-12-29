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
import { CreateFineDto } from './dto/create-fine.dto';
import { UpdateFineDto } from './dto/update-fine.dto';
import { FinesService } from './fines.service';

@Controller('fines')
export class FinesController {
  constructor(private readonly finesService: FinesService) {}

  @Get()
  findAll() {
    return this.finesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.finesService.findOne(id);
  }

  @Post()
  create(@Body() payload: CreateFineDto) {
    return this.finesService.create(payload);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateFineDto,
  ) {
    return this.finesService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.finesService.remove(id);
  }
}
