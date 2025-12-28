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
import { CreateRoutePointDto } from './dto/create-route-point.dto';
import { UpdateRoutePointDto } from './dto/update-route-point.dto';
import { RoutePointsService } from './route-points.service';

@Controller('route-points')
export class RoutePointsController {
  constructor(private readonly routePointsService: RoutePointsService) {}

  @Get()
  findAll() {
    return this.routePointsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.routePointsService.findOne(id);
  }

  @Post()
  create(@Body() payload: CreateRoutePointDto) {
    return this.routePointsService.create(payload);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateRoutePointDto,
  ) {
    return this.routePointsService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.routePointsService.remove(id);
  }
}
