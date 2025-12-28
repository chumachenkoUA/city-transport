import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateRoutePointDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  routeId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  lon!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
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
