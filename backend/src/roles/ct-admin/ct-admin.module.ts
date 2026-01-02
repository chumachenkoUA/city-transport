import { Module } from '@nestjs/common';
import { DriversModule } from '../../modules/drivers/drivers.module';
import { RoutesModule } from '../../modules/routes/routes.module';
import { StopsModule } from '../../modules/stops/stops.module';
import { TransportTypesModule } from '../../modules/transport-types/transport-types.module';
import { UsersModule } from '../../modules/users/users.module';
import { VehiclesModule } from '../../modules/vehicles/vehicles.module';
import { CtAdminController } from './ct-admin.controller';
import { CtAdminService } from './ct-admin.service';

@Module({
  imports: [
    UsersModule,
    DriversModule,
    StopsModule,
    TransportTypesModule,
    RoutesModule,
    VehiclesModule,
  ],
  controllers: [CtAdminController],
  providers: [CtAdminService],
})
export class CtAdminModule {}
