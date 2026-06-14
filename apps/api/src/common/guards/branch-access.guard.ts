import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';
import { BranchAccessService } from '../services/branch-access.service';

@Injectable()
export class BranchAccessGuard implements CanActivate {
  constructor(private readonly branchAccess: BranchAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      query?: Record<string, string>;
      body?: Record<string, string>;
      params?: Record<string, string>;
      headers?: Record<string, string | string[] | undefined>;
    }>();

    const user = request.user;
    if (!user) {
      return true;
    }

    const branchId =
      request.query?.branchId ??
      request.body?.branchId ??
      request.body?.fromBranchId ??
      request.params?.branchId ??
      (typeof request.headers?.['x-branch-id'] === 'string'
        ? request.headers['x-branch-id']
        : undefined);

    if (!branchId) {
      return true;
    }

    await this.branchAccess.assertUserBranchAccess(user, branchId);
    return true;
  }
}
