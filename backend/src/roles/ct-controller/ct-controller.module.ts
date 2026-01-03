import { Module } from '@nestjs/common';
import { CtControllerController } from './ct-controller.controller';
import { CtControllerService } from './ct-controller.service';

@Module({
  controllers: [CtControllerController],
  providers: [CtControllerService],
})
export class CtControllerModule {}
