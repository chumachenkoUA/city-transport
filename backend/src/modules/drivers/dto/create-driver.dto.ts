import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';
import { PassportDataDto } from './passport-data.dto';

export class CreateDriverDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._-]{3,32}$/)
  login!: string;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  password?: string;

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
  @IsNotEmpty()
  driverLicenseNumber!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  licenseCategories!: string[];

  @ValidateNested()
  @Type(() => PassportDataDto)
  passportData!: PassportDataDto;
}
