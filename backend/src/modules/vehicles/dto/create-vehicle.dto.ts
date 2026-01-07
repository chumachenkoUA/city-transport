import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  fleetNumber!: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  vehicleModelId?: number;

  @IsInt()
  @Min(1)
  routeId!: number;
}
