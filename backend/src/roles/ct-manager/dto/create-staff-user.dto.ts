import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateStaffUserDto {
  @IsString()
  @MinLength(3)
  login: string;

  @IsString()
  @MinLength(4)
  password: string;

  @IsString()
  @IsIn(['dispatcher', 'controller', 'accountant', 'municipality', 'manager'])
  role: 'dispatcher' | 'controller' | 'accountant' | 'municipality' | 'manager';

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
