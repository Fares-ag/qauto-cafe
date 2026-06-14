import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CryptoService } from '../common/crypto.service';
import { RegisterTerminalDto } from './dto/register-terminal.dto';

@Injectable()
export class TerminalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
  ) {}

  async register(dto: RegisterTerminalDto, organizationId?: string) {
    const branch = await this.prisma.branch.findFirst({
      where: {
        id: dto.branchId,
        deletedAt: null,
        isActive: true,
        ...(organizationId ? { organizationId } : {}),
      },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const deviceToken = this.crypto.generateDeviceToken();

    const terminal = await this.prisma.terminal.create({
      data: {
        branchId: dto.branchId,
        locationId: dto.locationId,
        name: dto.name,
        type: dto.type,
        deviceToken,
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
    });

    return {
      terminalId: terminal.id,
      deviceToken,
      name: terminal.name,
      type: terminal.type,
      branch: terminal.branch,
    };
  }

  async listByBranch(branchId: string, organizationId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId, deletedAt: null },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    return this.prisma.terminal.findMany({
      where: { branchId, deletedAt: null, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        lastSeenAt: true,
        locationId: true,
      },
    });
  }
}
