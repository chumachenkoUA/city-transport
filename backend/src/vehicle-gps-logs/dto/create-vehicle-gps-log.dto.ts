import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateVehicleGpsLogDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  vehicleId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  lon!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 7 })
  lat!: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  recordedAt?: Date;
}
