import { Type } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { PassportDataDto } from './passport-data.dto';

export class UpdateDriverDto {
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

  @IsString()
  @IsOptional()
  driverLicenseNumber?: string;

  @ValidateNested()
  @Type(() => PassportDataDto)
  @IsOptional()
  passportData?: PassportDataDto;
}
