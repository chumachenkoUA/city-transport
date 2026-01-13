import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateSalaryPaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  driverId?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  rate?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  units?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  total?: number;
}
