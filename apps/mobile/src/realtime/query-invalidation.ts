import type { QueryClient, QueryKey } from '@tanstack/react-query';
import type { RealtimeEvent, RealtimeEventType } from '@homeapp/shared-types';
import { queryKeys } from '../api';

const realtimeInvalidationKeys: Record<RealtimeEventType, QueryKey[]> = {
  'annual_cost.changed': [queryKeys.annualCosts],
  'attachment.changed': [queryKeys.attachments],
  'calendar.changed': [queryKeys.start, queryKeys.calendar],
  'cleaning.changed': [queryKeys.cleaning],
  'data.changed': [queryKeys.dataEntries],
  'finance.changed': [queryKeys.start, queryKeys.finances],
  'finance.month.generated': [queryKeys.start, queryKeys.finances],
  'household.changed': [queryKeys.household, queryKeys.permissions],
  'meal.changed': [queryKeys.start, queryKeys.meal],
  'note.changed': [queryKeys.notes],
  'permissions.changed': [queryKeys.household, queryKeys.permissions],
  'shopping.changed': [queryKeys.shopping],
  'todo.changed': [queryKeys.start, queryKeys.todo]
};

export function getRealtimeInvalidationKeys(event: RealtimeEvent): QueryKey[] {
  return realtimeInvalidationKeys[event.type];
}

export async function invalidateRealtimeEventQueries(
  queryClient: QueryClient,
  event: RealtimeEvent
): Promise<void> {
  await Promise.all(
    getRealtimeInvalidationKeys(event).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey })
    )
  );
}

