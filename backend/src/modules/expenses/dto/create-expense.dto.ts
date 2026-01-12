import { Type } from 'class-transformer';
import {
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { IsNotFutureDate } from '../../../common/validators';

export class CreateExpenseDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100, { message: 'Category must be at most 100 characters' })
  category!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount!: number;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: 'Description must be at most 500 characters' })
  description?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  @IsNotFutureDate({ message: 'Expense date cannot be in the future' })
  occurredAt?: Date;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  documentRef?: string;
}
