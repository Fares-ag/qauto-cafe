import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { CryptoService } from '../common/crypto.service';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { PinLockoutService } from './pin-lockout.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    RedisModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret')!,
        signOptions: {
          expiresIn: config.get<string>('jwt.accessExpiresIn', '15m') as `${number}m`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, CryptoService, PermissionsGuard, PinLockoutService],
  exports: [AuthService, JwtModule, PermissionsGuard],
})
export class AuthModule {}
