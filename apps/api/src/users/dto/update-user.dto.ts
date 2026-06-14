import { IsEmail, IsEnum, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  lastName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  employeeNumber?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEnum(['ACTIVE', 'INACTIVE', 'SUSPENDED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export class AssignRoleDto {
  @IsString()
  roleId!: string;
}

export class SetUserBranchesDto {
  @IsString({ each: true })
  branchIds!: string[];

  @IsOptional()
  @IsString()
  defaultBranchId?: string;
}

export class ResetPinDto {
  @IsString()
  @Length(4, 6)
  @Matches(/^\d+$/, { message: 'PIN must contain digits only' })
  pin!: string;
}
