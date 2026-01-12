import { Type } from 'class-transformer';
import {
  IsDate,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { SalaryTotalMatches } from '../../../common/validators';

export class CreateSalaryPaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  driverId?: number;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  employeeName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  employeeRole?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Rate must be greater than 0' })
  @IsOptional()
  rate?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Units must be at least 1' })
  @IsOptional()
  units?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Total must be greater than 0' })
  @SalaryTotalMatches({
    message: 'Total must equal rate * units when both are provided',
  })
  total!: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  paidAt?: Date;
}
