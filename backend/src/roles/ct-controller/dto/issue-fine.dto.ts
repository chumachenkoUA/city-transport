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
  ValidateIf,
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

  @ValidateIf((value: IssueFineDto) => !value.tripId)
  @IsString()
  @IsNotEmpty()
  fleetNumber?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  routeNumber?: string;

  @Type(() => Number)
  @ValidateIf((value: IssueFineDto) => !value.fleetNumber)
  @IsInt()
  @Min(1)
  tripId?: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  checkedAt?: Date;

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
