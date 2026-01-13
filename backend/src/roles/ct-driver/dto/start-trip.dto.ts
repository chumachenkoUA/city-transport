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
  tripId?: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  startedAt?: Date;
}
