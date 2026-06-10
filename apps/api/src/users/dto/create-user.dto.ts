import { IsEmail, IsOptional, IsString, Length, Matches, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(2)
  firstName!: string;

  @IsString()
  @MinLength(2)
  lastName!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @IsString()
  @Length(4, 6)
  @Matches(/^\d+$/, { message: 'PIN must contain digits only' })
  pin!: string;

  @IsOptional()
  @IsString()
  employeeNumber?: string;

  @IsString({ each: true })
  branchIds!: string[];
}
