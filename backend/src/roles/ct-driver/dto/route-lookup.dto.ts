import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const ROUTE_DIRECTIONS = ['forward', 'reverse'] as const;

export class RouteLookupDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  routeId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  transportTypeId?: number;

  @IsString()
  @IsOptional()
  routeNumber?: string;

  @IsString()
  @IsOptional()
  @IsIn(ROUTE_DIRECTIONS)
  direction?: (typeof ROUTE_DIRECTIONS)[number];
}
