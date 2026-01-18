import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Min } from 'class-validator';

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
