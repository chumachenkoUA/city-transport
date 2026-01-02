import { IsOptional, IsString, Matches } from 'class-validator';

export class DetectDeviationDto {
  @IsString()
  @IsOptional()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  currentTime?: string;
}
