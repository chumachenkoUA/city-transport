import { IsNotEmpty, IsString } from 'class-validator';

export class PassportDataDto {
  @IsString()
  @IsNotEmpty()
  series!: string;

  @IsString()
  @IsNotEmpty()
  number!: string;
}
