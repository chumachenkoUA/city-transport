import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateStopDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  @IsOptional()
  lon?: number;

  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  @IsOptional()
  lat?: number;
}
