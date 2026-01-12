import { IsIn, IsString } from 'class-validator';

export class UpdateComplaintStatusDto {
  @IsString()
  @IsIn(['Подано', 'Розглядається', 'Розглянуто'])
  status!: string;
}
