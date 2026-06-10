import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../../auth/types/authenticated-user.type';

type RequestWithUser = Request & { user?: AuthenticatedUser };

export const BranchId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string | undefined => {
  const request = ctx.switchToHttp().getRequest<RequestWithUser>();
  return (request.headers['x-branch-id'] as string | undefined) ?? request.user?.branchId;
});
