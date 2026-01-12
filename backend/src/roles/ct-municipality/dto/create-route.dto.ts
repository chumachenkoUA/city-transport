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
  Max,
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
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  @IsOptional()
  lon?: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
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
  @Min(-180, { message: 'Longitude must be between -180 and 180' })
  @Max(180, { message: 'Longitude must be between -180 and 180' })
  lon!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-90, { message: 'Latitude must be between -90 and 90' })
  @Max(90, { message: 'Latitude must be between -90 and 90' })
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
