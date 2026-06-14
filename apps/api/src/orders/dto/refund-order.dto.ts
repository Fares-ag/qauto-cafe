import { IsArray, IsOptional, IsString } from 'class-validator';

export class RefundOrderDto {
  @IsString()
  reason!: string;

  @IsOptional()
  restockInventory?: boolean;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lineIds?: string[];
}
