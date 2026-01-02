import { IsDateString, IsOptional, IsString } from 'class-validator';

export class ExpensesQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsString()
  @IsOptional()
  category?: string;
}
