import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const ROUTE_DIRECTIONS = ['forward', 'reverse'] as const;

export class AssignDriverDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  driverId?: number;

  @IsString()
  @IsOptional()
  driverLogin?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  vehicleId?: number;

  @IsString()
  @IsOptional()
  fleetNumber?: string;

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

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  assignedAt?: Date;
}
