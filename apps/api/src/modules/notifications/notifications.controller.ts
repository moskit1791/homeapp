import { Body, Controller, Post, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentHousehold } from '../../shared/decorators/current-household.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { HouseholdContext, UserContext } from '../../shared/request-context';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdContextGuard } from '../households/guards/household-context.guard';
import {
  RegisterPushTokenDto,
  SendTestPushDto
} from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, HouseholdContextGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('push-tokens')
  registerPushToken(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @CurrentUser() user: UserContext | undefined,
    @Body() dto: RegisterPushTokenDto
  ) {
    return this.notificationsService.registerExpoPushToken(
      this.requireHousehold(household),
      this.requireUser(user),
      dto
    );
  }

  @Post('test-push')
  sendTestPush(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: SendTestPushDto
  ) {
    return this.notificationsService.sendTestPush(this.requireHousehold(household), dto);
  }

  private requireHousehold(household: HouseholdContext | undefined): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException('Missing household context');
    }

    return household;
  }

  private requireUser(user: UserContext | undefined): UserContext {
    if (!user) {
      throw new UnauthorizedException('Missing user context');
    }

    return user;
  }
}
