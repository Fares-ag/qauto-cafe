import { IsString, Length, Matches } from 'class-validator';

export class PinLoginDto {
  @IsString()
  terminalId!: string;

  @IsString()
  @Length(4, 6)
  @Matches(/^\d+$/, { message: 'PIN must contain digits only' })
  pin!: string;
}
