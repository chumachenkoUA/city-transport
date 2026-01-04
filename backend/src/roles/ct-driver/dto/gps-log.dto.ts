import { IsNumber, IsOptional, IsString } from 'class-validator';

export class GpsLogDto {
  @IsNumber()
  lon!: number;

  @IsNumber()
  lat!: number;

  @IsString()
  @IsOptional()
  recordedAt?: string;
}
