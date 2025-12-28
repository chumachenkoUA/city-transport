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
import { CreateTransportTypeDto } from './dto/create-transport-type.dto';
import { UpdateTransportTypeDto } from './dto/update-transport-type.dto';
import { TransportTypesService } from './transport-types.service';

@Controller('transport-types')
export class TransportTypesController {
  constructor(private readonly transportTypesService: TransportTypesService) {}

  @Get()
  findAll() {
    return this.transportTypesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.transportTypesService.findOne(id);
  }

  @Post()
  create(@Body() payload: CreateTransportTypeDto) {
    return this.transportTypesService.create(payload);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateTransportTypeDto,
  ) {
    return this.transportTypesService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.transportTypesService.remove(id);
  }
}
