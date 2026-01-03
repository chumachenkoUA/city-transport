import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

export class RoutesListDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  transportTypeId?: number;
}
