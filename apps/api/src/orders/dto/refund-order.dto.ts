import { IsOptional, IsString } from 'class-validator';



export class RefundOrderDto {

  @IsString()

  reason!: string;



  @IsOptional()

  restockInventory?: boolean;



  @IsOptional()

  @IsString()

  idempotencyKey?: string;

}


