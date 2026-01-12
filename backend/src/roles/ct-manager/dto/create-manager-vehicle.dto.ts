import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateManagerVehicleDto {
  @IsString()
  @IsNotEmpty()
  fleetNumber!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  modelId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  routeId?: number;

  @IsString()
  @IsOptional()
  routeNumber?: string;

  @IsString()
  @IsOptional()
  direction?: string;
}
