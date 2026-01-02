import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { PassportDataDto } from './passport-data.dto';

export class UpdateDriverDto {
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

  @IsString()
  @IsOptional()
  driverLicenseNumber?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  licenseCategories?: string[];

  @ValidateNested()
  @Type(() => PassportDataDto)
  @IsOptional()
  passportData?: PassportDataDto;
}
