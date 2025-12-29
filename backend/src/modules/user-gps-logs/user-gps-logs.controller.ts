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
import { CreateUserGpsLogDto } from './dto/create-user-gps-log.dto';
import { UpdateUserGpsLogDto } from './dto/update-user-gps-log.dto';
import { UserGpsLogsService } from './user-gps-logs.service';

@Controller('user-gps-logs')
export class UserGpsLogsController {
  constructor(private readonly userGpsLogsService: UserGpsLogsService) {}

  @Get()
  findAll() {
    return this.userGpsLogsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.userGpsLogsService.findOne(id);
  }

  @Post()
  create(@Body() payload: CreateUserGpsLogDto) {
    return this.userGpsLogsService.create(payload);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateUserGpsLogDto,
  ) {
    return this.userGpsLogsService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.userGpsLogsService.remove(id);
  }
}
