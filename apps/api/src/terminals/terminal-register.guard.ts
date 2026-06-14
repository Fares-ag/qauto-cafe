import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Injectable()
export class TerminalRegisterGuard extends AuthGuard('jwt') {
  constructor(private readonly config: ConfigService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();

    const enrollmentKey = request.headers['x-terminal-enrollment-key'];
    const expected = this.config.get<string>('terminalEnrollmentSecret', '');

    if (expected && enrollmentKey === expected) {
      return true;
    }

    try {
      const activated = (await super.canActivate(context)) as boolean;
      if (!activated) return false;
      const user = request.user;
      if (
        user?.permissions?.includes('*') ||
        user?.permissions?.includes('terminal.manage')
      ) {
        return true;
      }
    } catch {
      // fall through
    }

    throw new ForbiddenException(
      'Provide a valid enrollment key or authenticate with terminal.manage permission',
    );
  }

  handleRequest<TUser = AuthenticatedUser>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      return null as TUser;
    }
    return user;
  }
}
