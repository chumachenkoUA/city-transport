import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateVehicleDto {
  @IsString()
  @IsOptional()
  fleetNumber?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  transportTypeId?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  capacity?: number;

  @IsInt()
  @Min(1)
  @IsOptional()
  routeId?: number;
}
