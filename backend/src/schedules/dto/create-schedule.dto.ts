import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsString, Matches, Min } from 'class-validator';

export class CreateScheduleDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  routeId!: number;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}:\d{2}$/)
  workStartTime!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{2}:\d{2}:\d{2}$/)
  workEndTime!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  intervalMin!: number;
}
