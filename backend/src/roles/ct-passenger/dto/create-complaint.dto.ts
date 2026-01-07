import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePassengerComplaintDto {
  @IsString()
  @IsNotEmpty()
  type!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

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
