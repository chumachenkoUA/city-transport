import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class MunicipalityComplaintsQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsString()
  @IsOptional()
  routeNumber?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  transportTypeId?: number;

  @IsString()
  @IsOptional()
  fleetNumber?: string;
}
