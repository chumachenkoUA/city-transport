import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateCardTopUpDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cardId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  toppedUpAt?: Date;
}
