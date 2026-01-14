import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Max, Min } from 'class-validator';

export class StopsNearDto {
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lon!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(50000) // 50km max radius
  @IsOptional()
  radius?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000) // Prevent DoS with huge limits
  @IsOptional()
  limit?: number;
}
