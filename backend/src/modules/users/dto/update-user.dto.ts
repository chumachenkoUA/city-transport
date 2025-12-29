import { IsEmail, IsOptional, IsString, Matches } from 'class-validator';

export class UpdateUserDto {
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
