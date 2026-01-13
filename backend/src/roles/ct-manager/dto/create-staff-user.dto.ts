export class CreateStaffUserDto {
  login: string;
  password: string;
  role: 'dispatcher' | 'controller' | 'accountant' | 'municipality' | 'manager';
  fullName?: string;
  email?: string;
  phone?: string;
}
