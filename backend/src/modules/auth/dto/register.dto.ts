import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._-]{3,32}$/)
  login!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\+?[0-9]{10,15}$/)
  phone!: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
