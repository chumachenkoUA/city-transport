import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateIncomeDto {
  @IsNotEmpty()
  @IsString()
  source: string; // 'government' | 'other'

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  receivedAt?: Date;
}
