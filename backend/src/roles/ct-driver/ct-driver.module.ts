import { Module } from '@nestjs/common';
import { CtDriverController } from './ct-driver.controller';
import { CtDriverService } from './ct-driver.service';

@Module({
  controllers: [CtDriverController],
  providers: [CtDriverService],
})
export class CtDriverModule {}
