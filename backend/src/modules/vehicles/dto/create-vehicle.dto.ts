import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

export class CreateVehicleDto {
  @IsString()
  @IsNotEmpty()
  fleetNumber!: string;

  @IsInt()
  @Min(1)
  transportTypeId!: number;

  @IsInt()
  @Min(1)
  capacity!: number;

  @IsInt()
  @Min(1)
  routeId!: number;
}
