import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { LoginDto } from './dto/login.dto';
import { PinLoginDto } from './dto/pin-login.dto';
import { AuthenticatedUser, JwtPayload } from './types/authenticated-user.type';
import type { LoginResponse } from '@qauto/shared-types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
  ) {}

  async login(dto: LoginDto, ipAddress?: string, userAgent?: string): Promise<LoginResponse & { refreshToken: string }> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: dto.email.toLowerCase(),
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: { role: true },
    });

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const defaultBranch = await this.prisma.userBranch.findFirst({
      where: { userId: user.id, isDefault: true },
    });

    return this.issueTokens(user, {
      branchId: defaultBranch?.branchId,
      ipAddress,
      userAgent,
    });
  }

  async pinLogin(dto: PinLoginDto, ipAddress?: string): Promise<LoginResponse & { refreshToken: string }> {
    const terminal = await this.prisma.terminal.findFirst({
      where: {
        id: dto.terminalId,
        isActive: true,
        deletedAt: null,
      },
    });

    if (!terminal) {
      throw new NotFoundException('Terminal not found');
    }

    const users = await this.prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        pinHash: { not: null },
        branches: { some: { branchId: terminal.branchId } },
      },
      include: { role: true },
    });

    let matchedUser: (typeof users)[number] | null = null;
    for (const user of users) {
      if (user.pinHash && (await bcrypt.compare(dto.pin, user.pinHash))) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      throw new UnauthorizedException('Invalid PIN');
    }

    await this.prisma.terminal.update({
      where: { id: terminal.id },
      data: { lastSeenAt: new Date() },
    });

    return this.issueTokens(matchedUser, {
      branchId: terminal.branchId,
      terminalId: terminal.id,
      ipAddress,
    });
  }

  async refresh(refreshToken: string): Promise<LoginResponse & { refreshToken: string }> {
    const tokenHash = this.crypto.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: { include: { role: true } },
        terminal: true,
      },
    });

    if (!stored) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const defaultBranch = await this.prisma.userBranch.findFirst({
      where: { userId: stored.userId, isDefault: true },
    });

    return this.issueTokens(stored.user, {
      branchId: stored.terminal?.branchId ?? defaultBranch?.branchId,
      terminalId: stored.terminalId ?? undefined,
    });
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;

    const tokenHash = this.crypto.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async getMe(user: AuthenticatedUser) {
    const record = await this.prisma.user.findUnique({
      where: { id: user.id },
      include: {
        role: true,
        branches: { include: { branch: true } },
      },
    });

    if (!record) {
      throw new NotFoundException('User not found');
    }

    return {
      id: record.id,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      employeeNumber: record.employeeNumber,
      role: record.role.slug,
      organizationId: record.organizationId,
      branches: record.branches.map((ub: (typeof record.branches)[number]) => ({
        id: ub.branch.id,
        name: ub.branch.name,
        code: ub.branch.code,
        isDefault: ub.isDefault,
      })),
      terminalId: user.terminalId,
      branchId: user.branchId,
    };
  }

  private async issueTokens(
    user: {
      id: string;
      organizationId: string;
      firstName: string;
      lastName: string;
      role: { slug: string };
    },
    context: {
      branchId?: string;
      terminalId?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<LoginResponse & { refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      organizationId: user.organizationId,
      role: user.role.slug,
      terminalId: context.terminalId,
      branchId: context.branchId,
    };

    const accessToken = await this.jwt.signAsync(payload);
    const refreshToken = this.crypto.generateRefreshToken();
    const refreshExpires = this.config.get<string>('jwt.refreshExpiresIn', '7d');
    const expiresAt = this.addDuration(new Date(), refreshExpires);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        terminalId: context.terminalId,
        tokenHash: this.crypto.hashToken(refreshToken),
        expiresAt,
      },
    });

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessExpiresIn = this.parseExpiresInSeconds(
      this.config.get<string>('jwt.accessExpiresIn', '15m'),
    );

    return {
      accessToken,
      expiresIn: accessExpiresIn,
      refreshToken,
      branchId: context.branchId,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.slug,
        organizationId: user.organizationId,
      },
    };
  }

  private parseExpiresInSeconds(value: string): number {
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) return 900;
    const amount = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return amount * (multipliers[unit] ?? 60);
  }

  private addDuration(from: Date, value: string): Date {
    const result = new Date(from);
    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) {
      result.setDate(result.getDate() + 7);
      return result;
    }
    const amount = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 'd') result.setDate(result.getDate() + amount);
    else if (unit === 'h') result.setHours(result.getHours() + amount);
    else if (unit === 'm') result.setMinutes(result.getMinutes() + amount);
    else result.setSeconds(result.getSeconds() + amount);
    return result;
  }
}
