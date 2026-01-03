import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { CtManagerController } from './ct-manager.controller';
import { CtManagerService } from './ct-manager.service';

@Module({
  imports: [DbModule],
  controllers: [CtManagerController],
  providers: [CtManagerService],
})
export class CtManagerModule {}
