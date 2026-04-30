import { Request } from 'express';
import { AccountStatus, HouseholdMemberRole } from '@homeapp/shared-types';

export interface UserContext {
  accountStatus: AccountStatus;
  authProviderUserId: string;
  email: string;
  userId: string;
}

export interface HouseholdContext {
  householdId: string;
  memberId: string;
  role: HouseholdMemberRole;
}

export interface AuthenticatedRequest extends Request {
  householdContext?: HouseholdContext;
  userContext?: UserContext;
}
