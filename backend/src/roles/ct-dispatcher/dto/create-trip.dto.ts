import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTripDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  routeId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  driverId!: number;

  @IsDateString()
  plannedStartsAt!: string;

  @IsDateString()
  @IsOptional()
  plannedEndsAt?: string;
}

export class GenerateDailyTripsDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  routeId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  driverId!: number;

  @IsDateString()
  date!: string;

  @IsString()
  startTime!: string; // HH:mm format

  @IsString()
  endTime!: string; // HH:mm format

  @Type(() => Number)
  @IsInt()
  @Min(1)
  intervalMin!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  tripDurationMin?: number;
}
