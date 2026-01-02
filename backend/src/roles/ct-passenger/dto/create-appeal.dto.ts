import { IsNotEmpty, IsString } from 'class-validator';

export class CreateAppealDto {
  @IsString()
  @IsNotEmpty()
  message!: string;
}
