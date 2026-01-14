import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { IsTimeAfter } from '../../../common/validators';

export class CreateScheduleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  routeId!: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}:\d{2}$/, {
    message: 'workStartTime must be in HH:MM:SS format',
  })
  workStartTime!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}:\d{2}$/, {
    message: 'workEndTime must be in HH:MM:SS format',
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
