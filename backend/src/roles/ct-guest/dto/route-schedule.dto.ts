import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { RouteLookupDto } from './route-lookup.dto';

export class RouteScheduleDto extends RouteLookupDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  stopId?: number;
}
