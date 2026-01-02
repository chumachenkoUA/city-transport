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
import { SalaryPaymentsService } from './salary-payments.service';
import { CreateSalaryPaymentDto } from './dto/create-salary-payment.dto';
import { UpdateSalaryPaymentDto } from './dto/update-salary-payment.dto';

@Controller('salary-payments')
export class SalaryPaymentsController {
  constructor(private readonly salaryPaymentsService: SalaryPaymentsService) {}

  @Get()
  findAll() {
    return this.salaryPaymentsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.salaryPaymentsService.findOne(id);
  }

  @Post()
  create(@Body() payload: CreateSalaryPaymentDto) {
    return this.salaryPaymentsService.create(payload);
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() payload: UpdateSalaryPaymentDto,
  ) {
    return this.salaryPaymentsService.update(id, payload);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.salaryPaymentsService.remove(id);
  }
}
