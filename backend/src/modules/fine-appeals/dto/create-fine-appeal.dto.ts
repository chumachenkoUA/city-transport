import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
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

export class CreateFineAppealDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  fineId!: number;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsIn(APPEAL_STATUSES)
  status!: (typeof APPEAL_STATUSES)[number];

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  createdAt?: Date;
}
