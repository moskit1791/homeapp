import {
  Controller,
  Get,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import { Response } from 'express';
import { CurrentHousehold } from '../../shared/decorators/current-household.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { HouseholdContext, UserContext } from '../../shared/request-context';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdContextGuard } from '../households/guards/household-context.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { CalendarGoogleService } from './calendar-google.service';

@Controller('calendar/google')
export class CalendarGoogleController {
  constructor(private readonly calendarGoogleService: CalendarGoogleService) {}

  @Get('status')
  @UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
  @RequirePermission('calendar', 'read')
  status(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @CurrentUser() user: UserContext | undefined
  ) {
    return this.calendarGoogleService.getConnectionStatus(
      this.requireHousehold(household),
      this.requireUser(user)
    );
  }

  @Post('connect')
  @UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
  @RequirePermission('calendar', 'read')
  connect(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @CurrentUser() user: UserContext | undefined
  ) {
    return this.calendarGoogleService.createAuthorizationUrl(
      this.requireHousehold(household),
      this.requireUser(user)
    );
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
  @RequirePermission('calendar', 'create')
  sync(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @CurrentUser() user: UserContext | undefined
  ) {
    return this.calendarGoogleService.sync(this.requireHousehold(household), this.requireUser(user));
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Query('state') state: string | undefined,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.calendarGoogleService.handleOAuthCallback({ code, error, state });

    response.type('html');

    return renderGoogleCalendarCallbackPage(result.googleAccountEmail);
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

function renderGoogleCalendarCallbackPage(email: string | null) {
  const account = email ? `<strong>${escapeHtml(email)}</strong>` : 'wybrane konto Google';

  return `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>HomeApp Google Calendar</title>
  <style>
    body { background: #101318; color: #f8fafc; font-family: system-ui, sans-serif; margin: 0; padding: 32px; }
    main { margin: 0 auto; max-width: 520px; }
    h1 { font-size: 24px; margin: 0 0 12px; }
    p { color: #cbd5e1; line-height: 1.55; }
  </style>
</head>
<body>
  <main>
    <h1>Kalendarz Google połączony</h1>
    <p>HomeApp ma dostęp do odczytu wydarzeń dla konta ${account}.</p>
    <p>Wróć do aplikacji i kliknij synchronizację, żeby pobrać wydarzenia.</p>
  </main>
</body>
</html>`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
