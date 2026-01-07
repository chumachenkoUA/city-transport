import { IsDateString, IsOptional } from 'class-validator';

export class PeriodDto {
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;
}
