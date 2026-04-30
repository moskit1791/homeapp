import { Injectable } from '@nestjs/common';
import { RealtimeEvent, RealtimeEventType } from '@homeapp/shared-types';
import { Observable, Subject, filter } from 'rxjs';

@Injectable()
export class RealtimeService {
  private readonly events$ = new Subject<RealtimeEvent>();

  createEvent(householdId: string, type: RealtimeEventType, resourceId?: string): RealtimeEvent {
    return {
      householdId,
      type,
      resourceId,
      occurredAt: new Date().toISOString()
    };
  }

  publish(event: RealtimeEvent): RealtimeEvent;
  publish(householdId: string, type: RealtimeEventType, resourceId?: string): RealtimeEvent;
  publish(
    eventOrHouseholdId: RealtimeEvent | string,
    type?: RealtimeEventType,
    resourceId?: string
  ): RealtimeEvent {
    const event =
      typeof eventOrHouseholdId === 'string'
        ? this.createEvent(eventOrHouseholdId, this.requireType(type), resourceId)
        : eventOrHouseholdId;

    this.events$.next(event);

    return event;
  }

  streamForHousehold(householdId: string): Observable<RealtimeEvent> {
    return this.events$.pipe(filter((event) => event.householdId === householdId));
  }

  private requireType(type: RealtimeEventType | undefined): RealtimeEventType {
    if (!type) {
      throw new Error('Realtime event type is required');
    }

    return type;
  }
}
