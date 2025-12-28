import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateVehicleGpsLogDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  vehicleId?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @IsOptional()
  lon?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  @IsOptional()
  lat?: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  recordedAt?: Date;
}
