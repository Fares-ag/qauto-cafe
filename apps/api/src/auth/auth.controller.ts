import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
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
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...response } = result;
    return response;
  }

  @Post('pin-login')
  async pinLogin(
    @Body() dto: PinLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.pinLogin(dto, req.ip);
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...response } = result;
    return response;
  }

  @Post('refresh')
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieName = this.config.get<string>('refreshCookieName', 'qauto_refresh');
    const refreshToken = req.cookies?.[cookieName] as string | undefined;
    if (!refreshToken) {
      return res.status(401).json({
        type: 'https://api.qauto.cafe/errors/unauthorized',
        title: 'Unauthorized',
        status: 401,
        detail: 'Refresh token missing',
      });
    }
    const result = await this.authService.refresh(refreshToken);
    this.setRefreshCookie(res, result.refreshToken);
    const { refreshToken: _, ...response } = result;
    return response;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieName = this.config.get<string>('refreshCookieName', 'qauto_refresh');
    const refreshToken = req.cookies?.[cookieName] as string | undefined;
    await this.authService.logout(refreshToken);
    res.clearCookie(cookieName);
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user);
  }

  private setRefreshCookie(res: Response, token: string) {
    const cookieName = this.config.get<string>('refreshCookieName', 'qauto_refresh');
    res.cookie(cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth',
    });
  }
}
