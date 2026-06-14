import { DiscountScope, DiscountType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ApplyOrderDiscountDto {
  @IsEnum(DiscountScope)
  scope!: DiscountScope;

  @IsEnum(DiscountType)
  type!: DiscountType;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  orderLineId?: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
