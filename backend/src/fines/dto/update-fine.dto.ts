import { Type } from 'class-transformer';
import { IsDate, IsIn, IsInt, IsOptional, Min } from 'class-validator';

const FINE_STATUSES = [
  'В процесі',
  'Оплачено',
  'Відмінено',
  'Прострочено',
] as const;

export class UpdateFineDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  userId?: number;

  @IsIn(FINE_STATUSES)
  @IsOptional()
  status?: (typeof FINE_STATUSES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  tripId?: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  issuedAt?: Date;
}
