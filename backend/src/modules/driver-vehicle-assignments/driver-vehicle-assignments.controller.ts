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
import { CreateDriverVehicleAssignmentDto } from './dto/create-driver-vehicle-assignment.dto';
import { UpdateDriverVehicleAssignmentDto } from './dto/update-driver-vehicle-assignment.dto';
import { DriverVehicleAssignmentsService } from './driver-vehicle-assignments.service';

@Controller('driver-vehicle-assignments')
export class DriverVehicleAssignmentsController {
  constructor(
    private readonly driverVehicleAssignmentsService: DriverVehicleAssignmentsService,
  ) {}

  @Get()
  findAll() {
    return this.driverVehicleAssignmentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.driverVehicleAssignmentsService.findOne(id);
  }

  @Post()
  create(@Body() payload: CreateDriverVehicleAssignmentDto) {
    return this.driverVehicleAssignmentsService.create(payload);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateDriverVehicleAssignmentDto,
  ) {
    return this.driverVehicleAssignmentsService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.driverVehicleAssignmentsService.remove(id);
  }
}
