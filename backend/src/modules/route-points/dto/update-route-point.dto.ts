import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateRoutePointDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  routeId?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @IsOptional()
  lon?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @IsOptional()
  lat?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  prevRoutePointId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  nextRoutePointId?: number;
}
