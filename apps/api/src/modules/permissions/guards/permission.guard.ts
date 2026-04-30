import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../../../shared/request-context';
import {
  REQUIRE_PERMISSION_KEY,
  RequiredPermission
} from '../decorators/require-permission.decorator';
import { PermissionsService } from '../permissions.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly reflector: Reflector
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const householdContext = request.householdContext;

    if (!householdContext) {
      throw new ForbiddenException('Missing household context');
    }

    if (householdContext.role === 'owner') {
      return true;
    }

    const allowed = await this.permissionsService.hasPermission(
      householdContext.memberId,
      required.moduleKey,
      required.action
    );

    if (!allowed) {
      throw new ForbiddenException('Missing module permission');
    }

    return true;
  }
}
