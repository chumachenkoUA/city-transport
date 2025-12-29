import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const APPEAL_STATUSES = [
  'Подано',
  'Перевіряється',
  'Відхилено',
  'Прийнято',
] as const;

export class UpdateFineAppealDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  fineId?: number;

  @IsString()
  @IsOptional()
  message?: string;

  @IsIn(APPEAL_STATUSES)
  @IsOptional()
  status?: (typeof APPEAL_STATUSES)[number];

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  createdAt?: Date;
}
