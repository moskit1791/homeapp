import {
  Controller,
  MessageEvent,
  Sse,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import { Observable, interval, map, merge } from 'rxjs';
import { CurrentHousehold } from '../../shared/decorators/current-household.decorator';
import { HouseholdContext } from '../../shared/request-context';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdContextGuard } from '../households/guards/household-context.guard';
import { RealtimeService } from './realtime.service';

const HEARTBEAT_INTERVAL_MS = 30000;

@Controller('realtime')
@UseGuards(JwtAuthGuard, HouseholdContextGuard)
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Sse('events')
  events(@CurrentHousehold() household: HouseholdContext | undefined): Observable<MessageEvent> {
    const householdId = this.requireHousehold(household).householdId;
    const events$ = this.realtimeService
      .streamForHousehold(householdId)
      .pipe(map((event): MessageEvent => ({ data: event })));
    const heartbeat$ = interval(HEARTBEAT_INTERVAL_MS).pipe(
      map(
        (): MessageEvent => ({
          data: { occurredAt: new Date().toISOString() },
          type: 'ping'
        })
      )
    );

    return merge(events$, heartbeat$);
  }

  private requireHousehold(household: HouseholdContext | undefined): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException('Missing household context');
    }

    return household;
  }
}
