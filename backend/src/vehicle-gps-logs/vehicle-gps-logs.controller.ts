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
import { CreateVehicleGpsLogDto } from './dto/create-vehicle-gps-log.dto';
import { UpdateVehicleGpsLogDto } from './dto/update-vehicle-gps-log.dto';
import { VehicleGpsLogsService } from './vehicle-gps-logs.service';

@Controller('vehicle-gps-logs')
export class VehicleGpsLogsController {
  constructor(private readonly vehicleGpsLogsService: VehicleGpsLogsService) {}

  @Get()
  findAll() {
    return this.vehicleGpsLogsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vehicleGpsLogsService.findOne(id);
  }

  @Post()
  create(@Body() payload: CreateVehicleGpsLogDto) {
    return this.vehicleGpsLogsService.create(payload);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateVehicleGpsLogDto,
  ) {
    return this.vehicleGpsLogsService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.vehicleGpsLogsService.remove(id);
  }
}
