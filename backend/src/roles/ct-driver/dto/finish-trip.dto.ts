import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class FinishTripDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  tripId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  vehicleId?: number;

  @IsString()
  @IsOptional()
  fleetNumber?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endedAt?: Date;
}
