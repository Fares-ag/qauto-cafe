import { IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethodType } from '@prisma/client';

export class PaymentInputDto {
  @IsEnum(PaymentMethodType)
  method!: PaymentMethodType;

  @IsString()
  amount!: string;

  @IsOptional()
  @IsString()
  reference?: string;
}

export class PayOrderDto {
  @ValidateNested({ each: true })
  @Type(() => PaymentInputDto)
  payments!: PaymentInputDto[];

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  loyaltyPointsRedeem?: number;

  @IsOptional()
  @IsString()
  rewardId?: string;

  @IsOptional()
  @IsString()
  giftCardCode?: string;
}

export class VoidOrderDto {
  @IsString()
  reason!: string;
}
