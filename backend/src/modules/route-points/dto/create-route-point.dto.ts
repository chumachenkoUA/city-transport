import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CreateRoutePointDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  routeId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  lon!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  lat!: number;

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
