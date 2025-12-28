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
import { CreateRouteStopDto } from './dto/create-route-stop.dto';
import { UpdateRouteStopDto } from './dto/update-route-stop.dto';
import { RouteStopsService } from './route-stops.service';

@Controller('route-stops')
export class RouteStopsController {
  constructor(private readonly routeStopsService: RouteStopsService) {}

  @Get()
  findAll() {
    return this.routeStopsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.routeStopsService.findOne(id);
  }

  @Post()
  create(@Body() payload: CreateRouteStopDto) {
    return this.routeStopsService.create(payload);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateRouteStopDto,
  ) {
    return this.routeStopsService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.routeStopsService.remove(id);
  }
}
