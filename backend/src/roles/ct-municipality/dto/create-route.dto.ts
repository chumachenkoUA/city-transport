import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

const ROUTE_DIRECTIONS = ['forward', 'reverse'] as const;

export class RouteStopInputDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  stopId?: number;

  @IsString()
  @IsOptional()
  name?: string;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  lon?: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  lat?: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  @IsOptional()
  distanceToNextKm?: number;
}

export class RoutePointInputDto {
  @Type(() => Number)
  @IsNumber()
  lon!: number;

  @Type(() => Number)
  @IsNumber()
  lat!: number;
}

export class CreateMunicipalityRouteDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  transportTypeId!: number;

  @IsString()
  @IsNotEmpty()
  number!: string;

  @IsString()
  @IsIn(ROUTE_DIRECTIONS)
  direction!: (typeof ROUTE_DIRECTIONS)[number];

  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => RouteStopInputDto)
  stops!: RouteStopInputDto[];

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => RoutePointInputDto)
  points!: RoutePointInputDto[];
}
