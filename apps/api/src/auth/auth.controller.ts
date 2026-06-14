import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from './types/authenticated-user.type';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Post('login')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(
      dto,
      req.ip,
      req.headers['user-agent'],
    );
    this.setAuthCookies(res, result.accessToken, result.refreshToken, 'manager');
    const { refreshToken: _, ...response } = result;
    return response;
  }

  @Post('pin-login')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async pinLogin(
    @Body() dto: PinLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.pinLogin(dto, req.ip);
    this.setAuthCookies(res, result.accessToken, result.refreshToken, 'staff');
    const { refreshToken: _, ...response } = result;
    return response;
  }

  @Post('refresh')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieName = this.config.get<string>('refreshCookieName', 'qauto_refresh');
    const refreshToken = req.cookies?.[cookieName] as string | undefined;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }
    const result = await this.authService.refresh(refreshToken);
    const sessionType =
      (req.cookies?.qauto_session_type as 'staff' | 'manager' | undefined) ?? 'manager';
    this.setAuthCookies(res, result.accessToken, result.refreshToken, sessionType);
    const { refreshToken: _, ...response } = result;
    return response;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshCookieName = this.config.get<string>('refreshCookieName', 'qauto_refresh');
    const accessCookieName = this.config.get<string>('accessCookieName', 'qauto_access');
    const refreshToken = req.cookies?.[refreshCookieName] as string | undefined;
    await this.authService.logout(refreshToken);
    res.clearCookie(refreshCookieName, { path: '/api/v1/auth' });
    res.clearCookie(accessCookieName, { path: '/api/v1' });
    res.clearCookie('qauto_session_type', { path: '/' });
    return { success: true };
  }

  @Get('me')
  @SkipThrottle()
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
  }

  private setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
    sessionType: 'staff' | 'manager',
  ) {
    const refreshCookieName = this.config.get<string>('refreshCookieName', 'qauto_refresh');
    const accessCookieName = this.config.get<string>('accessCookieName', 'qauto_access');
    const secure = process.env.NODE_ENV === 'production';

    res.cookie(refreshCookieName, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });

    const accessMaxAge = 15 * 60 * 1000;
    res.cookie(accessCookieName, accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: accessMaxAge,
      path: '/api/v1',
    });

    res.cookie('qauto_session_type', sessionType, {
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
  }
}
