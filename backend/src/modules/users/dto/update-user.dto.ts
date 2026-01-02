import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @Matches(/^[a-zA-Z0-9._-]{3,32}$/)
  login?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  @Matches(/^\+?[0-9]{10,15}$/)
  phone?: string;

  @IsString()
  @IsOptional()
  fullName?: string;
}
