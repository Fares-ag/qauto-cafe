import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { TerminalType } from '@prisma/client';

export class RegisterTerminalDto {
  @IsString()
  branchId!: string;

  @IsString()
  @MinLength(2)
  name!: string;

  @IsEnum(TerminalType)
  type!: TerminalType;

  @IsOptional()
  @IsString()
  locationId?: string;
}
