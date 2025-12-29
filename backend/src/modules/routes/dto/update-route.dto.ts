import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateRouteDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  transportTypeId?: number;

  @IsString()
  @IsOptional()
  number?: string;

  @IsIn(['forward', 'reverse'])
  @IsOptional()
  direction?: 'forward' | 'reverse';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
