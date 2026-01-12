import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CtControllerService } from './ct-controller.service';
import { IssueFineDto } from './dto/issue-fine.dto';

@Controller('controller')
export class CtControllerController {
  constructor(private readonly ctControllerService: CtControllerService) {}

  @Get('routes')
  getRoutes() {
    return this.ctControllerService.getRoutes();
  }

  @Get('vehicles')
  getVehicles(@Query('routeId') routeId?: number) {
    return this.ctControllerService.getVehicles(routeId);
  }

  @Get('vehicles/:fleetNumber/trips')
  getActiveTrips(
    @Param('fleetNumber') fleetNumber: string,
    @Query('checkedAt') checkedAt?: string,
  ) {
    return this.ctControllerService.getActiveTrips(fleetNumber, checkedAt);
  }

  @Get('cards/:cardNumber/check')
  checkCard(@Param('cardNumber') cardNumber: string) {
    return this.ctControllerService.checkCard(cardNumber);
  }

  @Post('fines')
  issueFine(@Body() payload: IssueFineDto) {
    return this.ctControllerService.issueFine(payload);
  }
}
