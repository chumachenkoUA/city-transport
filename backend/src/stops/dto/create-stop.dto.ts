import { IsNotEmpty, IsNumber, IsString, Max, Min } from 'class-validator';

export class CreateStopDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  lon!: number;

  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  lat!: number;
}
