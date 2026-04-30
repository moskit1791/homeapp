import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from '@nestjs/common';
import { AuthenticatedRequest } from '../../../shared/request-context';
import { HouseholdsService } from '../households.service';

@Injectable()
export class HouseholdContextGuard implements CanActivate {
  constructor(private readonly householdsService: HouseholdsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.userContext) {
      throw new UnauthorizedException('Missing user context');
    }

    const membership = await this.householdsService.findActiveMembershipForUser(
      request.userContext.userId
    );

    if (!membership) {
      throw new ForbiddenException('User has no active household');
    }

    request.householdContext = {
      householdId: membership.householdId,
      memberId: membership.memberId,
      role: membership.role
    };

    return true;
  }
}
