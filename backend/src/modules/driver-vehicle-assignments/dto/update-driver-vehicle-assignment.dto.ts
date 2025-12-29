import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateDriverVehicleAssignmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  driverId?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  vehicleId?: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  assignedAt?: Date;
}
