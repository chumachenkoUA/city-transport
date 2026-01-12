import { IsInt, IsNotEmpty, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PayFineDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsNotEmpty()
  cardId!: number;
}
