import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePassengerComplaintDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['complaint', 'suggestion'])
  type!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
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
