import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ShiftCashEventType } from '@prisma/client';

export class OpenShiftDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsOptional()
  @IsString()
  terminalId?: string;

  @IsString()
  openingFloat!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ShiftCashEventDto {
  @IsEnum(ShiftCashEventType)
  type!: ShiftCashEventType;

  @IsString()
  amount!: string;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class CloseShiftDto {
  @IsString()
  actualCash!: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
