import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class IssueGiftCardDto {
  @IsString()
  @IsNotEmpty()
  amount!: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}
