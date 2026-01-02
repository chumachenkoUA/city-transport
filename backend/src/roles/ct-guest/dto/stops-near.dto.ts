import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class StopsNearDto {
  @Type(() => Number)
  @IsNumber()
  lon!: number;

  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  radius?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  limit?: number;
}
