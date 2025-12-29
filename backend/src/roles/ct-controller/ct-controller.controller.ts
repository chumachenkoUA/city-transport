import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CtControllerService } from './ct-controller.service';
import { IssueFineDto } from './dto/issue-fine.dto';

@Controller('controller')
export class CtControllerController {
  constructor(private readonly ctControllerService: CtControllerService) {}

  @Get('cards/:cardNumber/last-trip')
  getLastTrip(@Param('cardNumber') cardNumber: string) {
    return this.ctControllerService.getLastTripByCardNumber(cardNumber);
  }

  @Post('fines')
  issueFine(@Body() payload: IssueFineDto) {
    return this.ctControllerService.issueFine(payload);
  }
}
