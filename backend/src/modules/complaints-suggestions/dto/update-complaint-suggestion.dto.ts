import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const COMPLAINT_STATUSES = ['Подано', 'Розглядається', 'Розглянуто'] as const;

export class UpdateComplaintSuggestionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  userId?: number;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  tripId?: number;

  @IsIn(COMPLAINT_STATUSES)
  @IsOptional()
  status?: (typeof COMPLAINT_STATUSES)[number];
}
