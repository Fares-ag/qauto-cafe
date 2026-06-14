import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReceiveStockDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  ingredientId!: string;

  @IsString()
  @IsNotEmpty()
  quantity!: string;

  @IsString()
  @IsNotEmpty()
  unitCost!: string;

  @IsOptional()
  @IsString()
  inputUomId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class WasteStockDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  ingredientId!: string;

  @IsString()
  @IsNotEmpty()
  quantity!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  inputUomId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class AdjustStockDto {
  @IsString()
  @IsNotEmpty()
  branchId!: string;

  @IsString()
  @IsNotEmpty()
  ingredientId!: string;

  @IsString()
  @IsNotEmpty()
  quantityDelta!: string;

  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsOptional()
  @IsString()
  unitCost?: string;

  @IsOptional()
  @IsString()
  inputUomId?: string;
}

export class TransferStockDto {
  @IsString()
  @IsNotEmpty()
  fromBranchId!: string;

  @IsString()
  @IsNotEmpty()
  toBranchId!: string;

  @IsString()
  @IsNotEmpty()
  ingredientId!: string;

  @IsString()
  @IsNotEmpty()
  quantity!: string;

  @IsOptional()
  @IsString()
  inputUomId?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
