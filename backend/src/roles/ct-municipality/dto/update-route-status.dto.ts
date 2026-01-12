import { IsBoolean } from 'class-validator';

export class UpdateRouteStatusDto {
  @IsBoolean()
  isActive!: boolean;
}
