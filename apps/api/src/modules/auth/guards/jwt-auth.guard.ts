import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { AuthenticatedRequest } from '../../../shared/request-context';
import { UsersService } from '../../users/users.service';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    const payload = this.authService.verifyAccessToken(token);
    const user = await this.usersService.findById(payload.userId);

    if (!user) {
      throw new UnauthorizedException('User is not registered locally');
    }

    if (user.accountStatus === 'banned') {
      throw new ForbiddenException('Account is banned');
    }

    request.userContext = {
      accountStatus: user.accountStatus,
      authProviderUserId: user.authProviderUserId,
      email: user.email,
      userId: user.id
    };

    return true;
  }

  private extractBearerToken(request: AuthenticatedRequest): string {
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    return header.slice('Bearer '.length).trim();
  }
}
