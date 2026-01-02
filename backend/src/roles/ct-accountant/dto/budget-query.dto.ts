import { IsDateString, IsOptional } from 'class-validator';

export class BudgetQueryDto {
  @IsDateString()
  @IsOptional()
  month?: string;
}
