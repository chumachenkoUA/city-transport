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
import { CreateCardTopUpDto } from './dto/create-card-top-up.dto';
import { UpdateCardTopUpDto } from './dto/update-card-top-up.dto';
import { CardTopUpsService } from './card-top-ups.service';

@Controller('card-top-ups')
export class CardTopUpsController {
  constructor(private readonly cardTopUpsService: CardTopUpsService) {}

  @Get()
  findAll() {
    return this.cardTopUpsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cardTopUpsService.findOne(id);
  }

  @Post()
  create(@Body() payload: CreateCardTopUpDto) {
    return this.cardTopUpsService.create(payload);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateCardTopUpDto,
  ) {
    return this.cardTopUpsService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.cardTopUpsService.remove(id);
  }
}
