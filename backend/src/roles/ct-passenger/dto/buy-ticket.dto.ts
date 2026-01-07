import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class BuyTicketDto {
  @IsNumber()
  @IsNotEmpty()
  cardId: number;

  @IsNumber()
  @IsNotEmpty()
  tripId: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(0)
  price: number;
}
