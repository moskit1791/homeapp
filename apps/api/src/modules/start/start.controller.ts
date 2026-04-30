import { Controller, Get, UnauthorizedException, UseGuards } from '@nestjs/common';
import { CurrentHousehold } from '../../shared/decorators/current-household.decorator';
import { HouseholdContext } from '../../shared/request-context';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdContextGuard } from '../households/guards/household-context.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { StartService } from './start.service';

@Controller('start')
@UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
export class StartController {
  constructor(private readonly startService: StartService) {}

  @Get('dashboard')
  @RequirePermission('start', 'read')
  getDashboard(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.startService.getDashboard(this.requireHousehold(household).householdId);
  }

  private requireHousehold(household: HouseholdContext | undefined): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException('Missing household context');
    }

    return household;
  }
}
