import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateSalaryPaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Driver ID must be a positive integer' })
  driverId!: number;

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
  @IsOptional()
  total?: number;
}
