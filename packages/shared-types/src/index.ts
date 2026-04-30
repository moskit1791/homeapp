export const MODULE_KEYS = [
  'start',
  'finances',
  'meal_planner',
  'calendar',
  'todo',
  'notes',
  'shopping',
  'cleaning',
  'annual_costs',
  'data_entries',
  'attachments',
  'household_members',
  'permissions'
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

export type PermissionAction = 'read' | 'create' | 'update' | 'delete';

export type AccountStatus = 'inactive' | 'active' | 'banned';

export type HouseholdMemberRole = 'owner' | 'member';

export type ScopeType = 'household' | 'member';

export type ShoppingListType = 'daily' | 'long_term';

export type TodoStatus = 'todo' | 'done';

export type CleaningFrequencyMode = 'preset' | 'custom_days';

export const REALTIME_EVENTS = [
  'finance.changed',
  'finance.month.generated',
  'meal.changed',
  'calendar.changed',
  'todo.changed',
  'note.changed',
  'shopping.changed',
  'cleaning.changed',
  'annual_cost.changed',
  'data.changed',
  'attachment.changed',
  'permissions.changed',
  'household.changed'
] as const;

export type RealtimeEventType = (typeof REALTIME_EVENTS)[number];

export interface RealtimeEvent {
  householdId: string;
  type: RealtimeEventType;
  resourceId?: string;
  occurredAt: string;
}

export interface PermissionSet {
  moduleKey: ModuleKey;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  role: HouseholdMemberRole;
  isActive: boolean;
  displayName: string;
}

export interface MoneySummary {
  incomeAmount: string;
  totalBudgetAmount: string;
  totalSpentAmount: string;
  totalRemainingAmount: string;
}

export interface BudgetItemSummary {
  id: string;
  ownerMemberId: string;
  categoryId: string;
  name: string;
  budgetAmount: string | null;
  spentAmount: string;
  remainingAmount: string | null;
  displayOrder: number;
}
