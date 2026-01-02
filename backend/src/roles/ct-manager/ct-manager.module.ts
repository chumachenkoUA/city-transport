import { Module } from '@nestjs/common';
import { DriversModule } from '../../modules/drivers/drivers.module';
import { VehiclesModule } from '../../modules/vehicles/vehicles.module';
import { CtManagerController } from './ct-manager.controller';
import { CtManagerService } from './ct-manager.service';

@Module({
  imports: [DriversModule, VehiclesModule],
  controllers: [CtManagerController],
  providers: [CtManagerService],
})
export class CtManagerModule {}
