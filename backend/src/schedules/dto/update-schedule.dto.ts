import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class UpdateScheduleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  routeId?: number;

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
