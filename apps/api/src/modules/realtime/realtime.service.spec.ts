import { describe, expect, it } from 'vitest';
import { RealtimeService } from './realtime.service';

function createService() {
  return new RealtimeService(
    {
      sendHouseholdChangeNotification: () => Promise.resolve({ sent: 0, tickets: [] })
    } as never,
    {
      get: () => undefined
    } as never
  );
}

describe('RealtimeService', () => {
  it('streams only events for the requested household', async () => {
    const service = createService();
    const householdOneEvents: string[] = [];
    const householdTwoEvents: string[] = [];
    const householdOneSubscription = service
      .streamForHousehold('household-1')
      .subscribe((event) => householdOneEvents.push(`${event.type}:${event.resourceId ?? ''}`));
    const householdTwoSubscription = service
      .streamForHousehold('household-2')
      .subscribe((event) => householdTwoEvents.push(`${event.type}:${event.resourceId ?? ''}`));

    service.publish('household-1', 'shopping.changed', 'shopping-1');
    service.publish('household-2', 'finance.changed', 'finance-2');
    service.publish('household-1', 'meal.changed', 'meal-1');

    householdOneSubscription.unsubscribe();
    householdTwoSubscription.unsubscribe();

    expect(householdOneEvents).toEqual(['shopping.changed:shopping-1', 'meal.changed:meal-1']);
    expect(householdTwoEvents).toEqual(['finance.changed:finance-2']);
  });

  it('keeps the original household id when publishing a prepared event', () => {
    const service = createService();
    const events: string[] = [];
    const subscription = service
      .streamForHousehold('household-1')
      .subscribe((event) => events.push(`${event.householdId}:${event.type}`));

    service.publish({
      householdId: 'household-2',
      occurredAt: new Date().toISOString(),
      resourceId: 'note-2',
      type: 'note.changed'
    });
    service.publish({
      householdId: 'household-1',
      occurredAt: new Date().toISOString(),
      resourceId: 'note-1',
      type: 'note.changed'
    });

    subscription.unsubscribe();

    expect(events).toEqual(['household-1:note.changed']);
  });
});
