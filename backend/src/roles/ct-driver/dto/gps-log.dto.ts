import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class GpsLogDto {
  @IsNumber()
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  lon!: number;

  @IsNumber()
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
  lat!: number;

  @IsString()
  @IsOptional()
  recordedAt?: string;
}
