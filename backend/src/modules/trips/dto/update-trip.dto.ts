import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTripDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  routeId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  driverId?: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  plannedStartsAt?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  plannedEndsAt?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  actualStartsAt?: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  actualEndsAt?: Date;

  @IsString()
  @IsOptional()
  status?: string;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  passengerCount?: number;
}
