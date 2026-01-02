import { IsDateString, IsOptional, IsString } from 'class-validator';

export class SalariesQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsString()
  @IsOptional()
  role?: string;
}
