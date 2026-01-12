import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { IsTimeAfter } from '../../../common/validators';

const ROUTE_DIRECTIONS = ['forward', 'reverse'] as const;

export class CreateDispatcherScheduleDto {
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
  @IsIn(ROUTE_DIRECTIONS)
  direction?: (typeof ROUTE_DIRECTIONS)[number];

  @IsString()
  @IsOptional()
  fleetNumber?: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, {
    message: 'workStartTime must be in HH:MM or HH:MM:SS format',
  })
  workStartTime!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/, {
    message: 'workEndTime must be in HH:MM or HH:MM:SS format',
  })
  @IsTimeAfter('workStartTime', {
    message: 'Work end time must be after work start time',
  })
  workEndTime!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Interval must be at least 1 minute' })
  @Max(1440, { message: 'Interval cannot exceed 24 hours (1440 minutes)' })
  intervalMin!: number;
}
