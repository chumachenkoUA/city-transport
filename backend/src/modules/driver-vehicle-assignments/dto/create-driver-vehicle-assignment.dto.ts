import { Type } from 'class-transformer';
import { IsDate, IsInt, IsOptional, Min } from 'class-validator';

export class CreateDriverVehicleAssignmentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  driverId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  vehicleId!: number;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  assignedAt?: Date;
}
