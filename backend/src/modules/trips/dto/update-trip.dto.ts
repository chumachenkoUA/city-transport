import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateTripDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  routeId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  vehicleId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  driverId?: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startsAt?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  endsAt?: Date;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  passengerCount?: number;
}
