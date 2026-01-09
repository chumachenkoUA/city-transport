import { IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class RoutePlannerDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lonA!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latA!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lonB!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latB!: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(100)
  @Max(5000)
  radius?: number; // default 500m

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(60)
  maxWaitMin?: number; // default 10 min

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(20)
  maxResults?: number; // default 5
}

export class SearchStopsDto {
  @Type(() => String)
  q!: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(50)
  limit?: number; // default 10
}
