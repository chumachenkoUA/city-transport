import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateRouteDto {
  @IsInt()
  @Min(1)
  transportTypeId!: number;

  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsIn(['forward', 'reverse'])
  direction!: 'forward' | 'reverse';

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
