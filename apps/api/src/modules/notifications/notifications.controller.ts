import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { CurrentHousehold } from "../../shared/decorators/current-household.decorator";
import { CurrentUser } from "../../shared/decorators/current-user.decorator";
import { HouseholdContext, UserContext } from "../../shared/request-context";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { HouseholdContextGuard } from "../households/guards/household-context.guard";
import {
  NotificationInboxIdParamDto,
  RegisterPushTokenDto,
  RegisterWebPushSubscriptionDto,
  SendTestPushDto,
  UpdateNotificationPreferencesDto,
} from "./dto/notifications.dto";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard, HouseholdContextGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post("push-tokens")
  registerPushToken(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @CurrentUser() user: UserContext | undefined,
    @Body() dto: RegisterPushTokenDto,
  ) {
    return this.notificationsService.registerExpoPushToken(
      this.requireHousehold(household),
      this.requireUser(user),
      dto,
    );
  }

  @Post("web-push-subscriptions")
  registerWebPushSubscription(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @CurrentUser() user: UserContext | undefined,
    @Body() dto: RegisterWebPushSubscriptionDto,
  ) {
    return this.notificationsService.registerWebPushSubscription(
      this.requireHousehold(household),
      this.requireUser(user),
      dto,
    );
  }

  @Post("test-push")
  sendTestPush(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: SendTestPushDto,
  ) {
    return this.notificationsService.sendTestPush(
      this.requireHousehold(household),
      dto,
    );
  }

  @Get("inbox")
  listInbox(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.notificationsService.listInbox(
      this.requireHousehold(household),
    );
  }

  @Patch("inbox/read-all")
  markAllInboxRead(
    @CurrentHousehold() household: HouseholdContext | undefined,
  ) {
    return this.notificationsService.markAllInboxRead(
      this.requireHousehold(household),
    );
  }

  @Patch("inbox/:id/read")
  async markInboxRead(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: NotificationInboxIdParamDto,
  ) {
    const notification = await this.notificationsService.markInboxRead(
      this.requireHousehold(household),
      params.id,
    );

    if (!notification) {
      throw new NotFoundException("Notification not found");
    }

    return notification;
  }

  @Get("preferences")
  listPreferences(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.notificationsService.listPreferences(
      this.requireHousehold(household),
    );
  }

  @Patch("preferences")
  updatePreferences(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(
      this.requireHousehold(household),
      dto,
    );
  }

  private requireHousehold(
    household: HouseholdContext | undefined,
  ): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException("Missing household context");
    }

    return household;
  }

  private requireUser(user: UserContext | undefined): UserContext {
    if (!user) {
      throw new UnauthorizedException("Missing user context");
    }

    return user;
  }
}
