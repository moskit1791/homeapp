import {
  BadRequestException,
  Body,
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
import { EncryptionService } from '../encryption/encryption.service';
import { HouseholdContextGuard } from '../households/guards/household-context.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { CalendarGoogleService } from './calendar-google.service';
import { CommitGoogleCalendarEncryptedSyncDto } from './dto/calendar.dto';

@Controller('calendar/google')
export class CalendarGoogleController {
  constructor(
    private readonly calendarGoogleService: CalendarGoogleService,
    private readonly encryptionService: EncryptionService
  ) {}

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
  async connect(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @CurrentUser() user: UserContext | undefined
  ) {
    const householdContext = this.requireHousehold(household);

    return this.calendarGoogleService.createAuthorizationUrl(
      householdContext,
      this.requireUser(user)
    );
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
  @RequirePermission('calendar', 'create')
  async sync(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @CurrentUser() user: UserContext | undefined
  ) {
    const householdContext = this.requireHousehold(household);
    const encryptionState =
      await this.encryptionService.getModuleEncryptionState(
        householdContext.householdId,
        'calendar'
      );

    return this.calendarGoogleService.sync(
      householdContext,
      this.requireUser(user),
      {
        clientEncryption: encryptionState.enabled
      }
    );
  }

  @Post('sync/encrypted')
  @UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
  @RequirePermission('calendar', 'create')
  async commitEncryptedSync(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @CurrentUser() user: UserContext | undefined,
    @Body() dto: CommitGoogleCalendarEncryptedSyncDto
  ) {
    const householdContext = this.requireHousehold(household);
    const encryptionState =
      await this.encryptionService.getModuleEncryptionState(
        householdContext.householdId,
        'calendar'
      );

    if (!encryptionState.enabled || !encryptionState.keyVersion) {
      throw new BadRequestException(
        'Calendar encryption is not enabled for this household'
      );
    }

    return this.calendarGoogleService.commitEncryptedSync(
      householdContext,
      this.requireUser(user),
      dto,
      encryptionState.keyVersion
    );
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('error') error: string | undefined,
    @Query('state') state: string | undefined,
    @Res({ passthrough: true }) response: Response
  ) {
    const result = await this.calendarGoogleService.handleOAuthCallback({
      code,
      error,
      state
    });

    response.type('html');

    return renderGoogleCalendarCallbackPage(result.googleAccountEmail);
  }

  private requireHousehold(
    household: HouseholdContext | undefined
  ): HouseholdContext {
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
  const account = email
    ? `<strong>${escapeHtml(email)}</strong>`
    : 'wybrane konto Google';

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
