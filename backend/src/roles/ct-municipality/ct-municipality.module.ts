import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module';
import { CtMunicipalityController } from './ct-municipality.controller';
import { CtMunicipalityService } from './ct-municipality.service';

@Module({
  imports: [DbModule],
  controllers: [CtMunicipalityController],
  providers: [CtMunicipalityService],
})
export class CtMunicipalityModule {}
