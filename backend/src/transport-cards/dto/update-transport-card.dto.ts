import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateTransportCardDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  userId?: number;

  @IsString()
  @IsOptional()
  cardNumber?: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  balance?: number;
}
