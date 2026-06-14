import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtPayload, AuthenticatedUser } from '../types/authenticated-user.type';

function cookieExtractor(config: ConfigService) {
  return (req: Request): string | null => {
    const cookieName = config.get<string>('accessCookieName', 'qauto_access');
    return (req.cookies?.[cookieName] as string | undefined) ?? null;
  };
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        cookieExtractor(config),
      ]),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, status: 'ACTIVE', deletedAt: null },
      include: {
        role: {
          include: {
            permissions: { include: { permission: { select: { code: true } } } },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return {
      id: user.id,
      organizationId: user.organizationId,
      roleId: user.roleId,
      role: user.role.slug,
      permissions: user.role.permissions.map((rp) => rp.permission.code),
      firstName: user.firstName,
      lastName: user.lastName,
      terminalId: payload.terminalId,
      branchId: payload.branchId,
    };
  }
}
