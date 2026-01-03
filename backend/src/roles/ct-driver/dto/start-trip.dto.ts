import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class StartTripDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  vehicleId?: number;

  @IsString()
  @IsOptional()
  fleetNumber?: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startedAt?: Date;

  @IsString()
  @IsOptional()
  @IsIn(['forward', 'reverse'])
  direction?: string;
}
