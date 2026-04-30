import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UnauthorizedException,
  UseGuards
} from '@nestjs/common';
import { CurrentHousehold } from '../../shared/decorators/current-household.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { HouseholdContext, UserContext } from '../../shared/request-context';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdContextGuard } from './guards/household-context.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { PermissionsService } from '../permissions/permissions.service';
import {
  CreateHouseholdDto,
  InviteMemberDto,
  MemberIdParamDto,
  PatchMemberPermissionsDto,
  UpdateHouseholdDto
} from './dto/household.dto';
import { HouseholdsService } from './households.service';

@Controller('households')
export class HouseholdsController {
  constructor(
    private readonly householdsService: HouseholdsService,
    private readonly permissionsService: PermissionsService
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  createHousehold(@CurrentUser() user: UserContext | undefined, @Body() dto: CreateHouseholdDto) {
    return this.householdsService.createHousehold(this.requireUser(user), dto);
  }

  @Get('me')
  @RequirePermission('household_members', 'read')
  @UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
  getMyHousehold(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.householdsService.getHousehold(this.requireHousehold(household).householdId);
  }

  @Patch('me')
  @RequirePermission('household_members', 'update')
  @UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
  updateMyHousehold(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Body() dto: UpdateHouseholdDto
  ) {
    return this.householdsService.updateHousehold(this.requireHousehold(household).householdId, dto);
  }

  @Get('me/members')
  @RequirePermission('household_members', 'read')
  @UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
  listMembers(@CurrentHousehold() household: HouseholdContext | undefined) {
    return this.householdsService.listMembers(this.requireHousehold(household).householdId);
  }

  @Get('me/permissions')
  @UseGuards(JwtAuthGuard, HouseholdContextGuard)
  listMyPermissions(@CurrentHousehold() household: HouseholdContext | undefined) {
    const context = this.requireHousehold(household);

    return this.permissionsService.listEffectivePermissions(context.memberId, context.role);
  }

  @Post('me/invitations')
  @RequirePermission('household_members', 'create')
  @UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
  createInvitation(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @CurrentUser() user: UserContext | undefined,
    @Body() dto: InviteMemberDto
  ) {
    return this.householdsService.createInvitation(
      this.requireHousehold(household).householdId,
      this.requireUser(user).userId,
      dto
    );
  }

  @Delete('me/members/:id')
  @RequirePermission('household_members', 'delete')
  @UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
  async removeMember(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: MemberIdParamDto
  ) {
    const removed = await this.householdsService.removeMember(
      this.requireHousehold(household).householdId,
      params.id
    );

    if (!removed) {
      throw new NotFoundException('Member not found');
    }

    return { ok: true };
  }

  @Patch('me/members/:id/permissions')
  @RequirePermission('permissions', 'update')
  @UseGuards(JwtAuthGuard, HouseholdContextGuard, PermissionGuard)
  updateMemberPermissions(
    @CurrentHousehold() household: HouseholdContext | undefined,
    @Param() params: MemberIdParamDto,
    @Body() dto: PatchMemberPermissionsDto
  ) {
    return this.householdsService.updateMemberPermissions(
      this.requireHousehold(household).householdId,
      params.id,
      dto
    );
  }

  private requireUser(user: UserContext | undefined): UserContext {
    if (!user) {
      throw new UnauthorizedException('Missing user context');
    }

    return user;
  }

  private requireHousehold(household: HouseholdContext | undefined): HouseholdContext {
    if (!household) {
      throw new UnauthorizedException('Missing household context');
    }

    return household;
  }
}
