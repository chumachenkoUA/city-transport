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
import { CreateTransportCardDto } from './dto/create-transport-card.dto';
import { UpdateTransportCardDto } from './dto/update-transport-card.dto';
import { TransportCardsService } from './transport-cards.service';

@Controller('transport-cards')
export class TransportCardsController {
  constructor(private readonly transportCardsService: TransportCardsService) {}

  @Get()
  findAll() {
    return this.transportCardsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.transportCardsService.findOne(id);
  }

  @Post()
  create(@Body() payload: CreateTransportCardDto) {
    return this.transportCardsService.create(payload);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateTransportCardDto,
  ) {
    return this.transportCardsService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.transportCardsService.remove(id);
  }
}
