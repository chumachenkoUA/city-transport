import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class RoutesBetweenDto {
  @Type(() => Number)
  @IsNumber()
  lonA!: number;

  @Type(() => Number)
  @IsNumber()
  latA!: number;

  @Type(() => Number)
  @IsNumber()
  lonB!: number;

  @Type(() => Number)
  @IsNumber()
  latB!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  radius?: number;
}
