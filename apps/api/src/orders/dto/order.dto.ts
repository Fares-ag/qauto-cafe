import {

  IsArray,

  IsEnum,

  IsInt,

  IsNotEmpty,

  IsOptional,

  IsString,

  Min,

  ValidateNested,

} from 'class-validator';

import { Type } from 'class-transformer';

import { OrderType } from '@prisma/client';



export class OrderLineInputDto {

  @IsString()

  @IsNotEmpty()

  menuItemId!: string;



  @IsOptional()

  @IsString()

  @IsNotEmpty()

  sizeId?: string;



  @IsInt()

  @Min(1)

  quantity!: number;



  @IsOptional()

  @IsArray()

  @IsString({ each: true })

  modifierIds?: string[];



  @IsOptional()

  @IsString()

  notes?: string;

}



export class CreateOrderDto {

  @IsString()

  @IsNotEmpty()

  branchId!: string;



  @IsOptional()

  @IsString()

  @IsNotEmpty()

  terminalId?: string;



  @IsOptional()

  @IsString()

  @IsNotEmpty()

  shiftId?: string;



  @IsOptional()

  @IsEnum(OrderType)

  orderType?: OrderType;



  @IsOptional()

  @IsString()

  customerName?: string;



  @IsOptional()

  @IsArray()

  @ValidateNested({ each: true })

  @Type(() => OrderLineInputDto)

  lines?: OrderLineInputDto[];

}



export class UpdateOrderLinesDto {

  @IsArray()

  @ValidateNested({ each: true })

  @Type(() => OrderLineInputDto)

  lines!: OrderLineInputDto[];

}

