import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedRequest, HouseholdContext } from '../request-context';

export const CurrentHousehold = createParamDecorator(
  (_data: unknown, context: ExecutionContext): HouseholdContext | undefined => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    return request.householdContext;
  }
);
