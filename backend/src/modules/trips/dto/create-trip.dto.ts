import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateTripDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  routeId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  driverId!: number;

  @Type(() => Date)
  @IsDate()
  plannedStartsAt!: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  plannedEndsAt?: Date;

  @IsString()
  @IsOptional()
  status?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  passengerCount?: number;
}
