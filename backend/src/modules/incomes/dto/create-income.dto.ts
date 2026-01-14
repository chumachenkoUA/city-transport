import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateIncomeDto {
  @IsIn(['government', 'tickets', 'fines', 'other'])
  source!: 'government' | 'tickets' | 'fines' | 'other';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  documentRef?: string;

  @IsDateString()
  @IsOptional()
  receivedAt?: string;
}
