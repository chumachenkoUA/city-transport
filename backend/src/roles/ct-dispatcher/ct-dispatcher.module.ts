import { Module } from '@nestjs/common';
import { CtDispatcherController } from './ct-dispatcher.controller';
import { CtDispatcherService } from './ct-dispatcher.service';

@Module({
  controllers: [CtDispatcherController],
  providers: [CtDispatcherService],
})
export class CtDispatcherModule {}
