import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class PassengerCountDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  tripId!: number;

  @IsInt()
  @Min(0)
  passengerCount!: number;
}
