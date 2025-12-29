import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateRouteStopDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  routeId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  stopId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  prevRouteStopId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  nextRouteStopId?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @IsOptional()
  distanceToNextKm?: number;
}
