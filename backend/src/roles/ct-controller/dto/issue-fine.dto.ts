import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

const FINE_STATUSES = [
  'Очікує сплати',
  'В процесі',
  'Оплачено',
  'Відмінено',
  'Прострочено',
] as const;

export class IssueFineDto {
  @IsString()
  @IsNotEmpty()
  cardNumber!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  tripId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsIn(FINE_STATUSES)
  @IsOptional()
  status?: (typeof FINE_STATUSES)[number];

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  issuedAt?: Date;
}
