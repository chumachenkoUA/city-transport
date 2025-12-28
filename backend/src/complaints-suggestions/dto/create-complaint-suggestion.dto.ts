import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const COMPLAINT_STATUSES = ['Подано', 'Розглядається', 'Розглянуто'] as const;

export class CreateComplaintSuggestionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId!: number;

  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  tripId?: number;

  @IsIn(COMPLAINT_STATUSES)
  status!: (typeof COMPLAINT_STATUSES)[number];
}
