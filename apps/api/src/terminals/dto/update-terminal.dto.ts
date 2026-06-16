import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateTerminalDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
