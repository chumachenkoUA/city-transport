import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Matches } from 'class-validator';

export class DetectDeviationDto {
  @IsString()
  @IsOptional()
  @Matches(/^(\d{2}:\d{2}(:\d{2})?|\d{4}-\d{2}-\d{2}T.*)$/)
  currentTime?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  lon?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  lat?: number;
}
