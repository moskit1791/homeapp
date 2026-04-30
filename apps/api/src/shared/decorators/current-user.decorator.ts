import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest, UserContext } from '../request-context';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserContext | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.userContext;
  }
);
