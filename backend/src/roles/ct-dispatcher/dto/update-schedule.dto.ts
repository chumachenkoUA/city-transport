import { Type } from 'class-transformer';
import {
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
  transportTypeId?: number;

  @IsString()
  @IsOptional()
  routeNumber?: string;

  @IsString()
  @IsOptional()
  @IsIn(ROUTE_DIRECTIONS)
  direction?: (typeof ROUTE_DIRECTIONS)[number];

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}:\d{2}$/)
  workStartTime?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}:\d{2}$/)
  workEndTime?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  intervalMin?: number;
}
