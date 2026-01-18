import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

const ROUTE_DIRECTIONS = ['forward', 'reverse'] as const;

export class UpdateDispatcherScheduleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  routeId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  vehicleId?: number;

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
  fleetNumber?: string;

  @IsString()
  @IsOptional()
  @IsIn(ROUTE_DIRECTIONS)
  direction?: (typeof ROUTE_DIRECTIONS)[number];

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  workStartTime?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  workEndTime?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  intervalMin?: number;

  // Days of week
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  monday?: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  tuesday?: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  wednesday?: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  thursday?: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  friday?: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  saturday?: boolean;

  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  @IsOptional()
  sunday?: boolean;
}
