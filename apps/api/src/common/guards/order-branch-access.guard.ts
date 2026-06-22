import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { BranchAccessService } from '../services/branch-access.service';

@Injectable()
export class OrderBranchAccessGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly branchAccess: BranchAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      params?: Record<string, string>;
    }>();

    const user = request.user;
    if (!user) {
      return true;
    }

    const orderId = request.params?.id ?? request.params?.orderId;
    if (!orderId) {
      return true;
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId: user.organizationId },
      select: { branchId: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    await this.branchAccess.assertUserBranchAccess(user, order.branchId);
    return true;
  }
}
