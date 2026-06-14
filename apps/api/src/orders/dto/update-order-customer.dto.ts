import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

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
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsDateString()
  paymentDueDate?: string;
}
