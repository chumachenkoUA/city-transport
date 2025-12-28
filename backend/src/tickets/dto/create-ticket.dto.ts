import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class CreateTicketDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tripId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cardId!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price!: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  purchasedAt?: Date;
}
