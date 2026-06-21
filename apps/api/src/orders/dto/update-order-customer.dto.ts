import { IsEnum, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { BillingParty } from '@prisma/client';

export class UpdateOrderCustomerDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  customerDepartment?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  customerId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  guestName?: string;

  @IsOptional()
  @IsEnum(BillingParty)
  billingParty?: BillingParty;

  @IsOptional()
  @IsString()
  paymentDueDate?: string;
}
