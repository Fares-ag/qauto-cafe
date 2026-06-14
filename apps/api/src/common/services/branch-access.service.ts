import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';

@Injectable()
export class BranchAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async assertBranchInOrg(branchId: string, organizationId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  async assertUserBranchAccess(user: AuthenticatedUser, branchId: string) {
    await this.assertBranchInOrg(branchId, user.organizationId);

    if (user.permissions.includes('*')) {
      return;
    }

    const membership = await this.prisma.userBranch.findFirst({
      where: { userId: user.id, branchId },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this branch');
    }
  }

  async assertUserBranchAccessById(userId: string, organizationId: string, branchId: string) {
    await this.assertBranchInOrg(branchId, organizationId);

    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, status: 'ACTIVE', deletedAt: null },
      include: {
        role: {
          include: {
            permissions: { include: { permission: { select: { code: true } } } },
          },
        },
      },
    });

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    const permissions = user.role.permissions.map((p) => p.permission.code);
    if (permissions.includes('*')) {
      return;
    }

    const membership = await this.prisma.userBranch.findFirst({
      where: { userId, branchId },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this branch');
    }
  }
}
