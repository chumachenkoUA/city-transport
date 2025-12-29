import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTransportTypeDto {
  @IsString()
  @IsNotEmpty()
  name!: string;
}
