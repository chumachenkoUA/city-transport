import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Min } from 'class-validator';

export class CreateTripDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  routeId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  vehicleId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  driverId!: number;

  @Type(() => Date)
  @IsDate()
  startsAt!: Date;

  @Type(() => Date)
  @IsDate()
  endsAt!: Date;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  passengerCount?: number;
}
