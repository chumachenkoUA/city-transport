import { IsNotEmpty, IsOptional, IsString, IsIn } from 'class-validator';

export class CreateGuestComplaintDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['complaint', 'suggestion'])
  type!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsString()
  @IsOptional()
  contactInfo?: string;

  @IsString()
  @IsOptional()
  routeNumber?: string;

  @IsString()
  @IsOptional()
  transportType?: string;

  @IsString()
  @IsOptional()
  vehicleNumber?: string;
}
