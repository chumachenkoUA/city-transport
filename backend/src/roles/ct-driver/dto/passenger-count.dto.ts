import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class PassengerCountDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  driverId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  vehicleId?: number;

  @IsString()
  @IsOptional()
  fleetNumber?: string;

  @IsDateString()
  date!: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  passengerCount!: number;
}
