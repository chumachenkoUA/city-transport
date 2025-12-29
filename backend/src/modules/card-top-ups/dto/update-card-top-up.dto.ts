import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateCardTopUpDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  cardId?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  amount?: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  toppedUpAt?: Date;
}
