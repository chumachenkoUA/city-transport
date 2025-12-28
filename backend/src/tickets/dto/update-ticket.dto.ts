import { Type } from 'class-transformer';
import { IsDate, IsInt, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateTicketDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  tripId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  cardId?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @IsOptional()
  price?: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  purchasedAt?: Date;
}
